import { pipeline } from "@xenova/transformers";
import Groq from "groq-sdk";
import pg from "pg";
import { goldenDataset } from "./golden-dataset.js";
import { evaluateFaithfulness } from "./eval-faithfulness.js";
import * as dotenv from "dotenv";

dotenv.config();
dotenv.config({ path: ".env.local", override: true });

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

const embedder = await pipeline(
    "feature-extraction", "Xenova/all-MiniLM-L6-v2"
);

async function retrieve(query, topK = 3, threshold = 0.55) {
    const vec = await embed(query);
    const vs = `[${vec.join(",")}]`;
    const r = await db.query(
        `SELECT title, content, 1-(embedding<=>$1::vector) AS similarity
        FROM kb_articles
        WHERE 1-(embedding<=>$1::vector) > $2
        ORDER BY embedding<=>$1::vector LIMIT $3`,
        [vs, threshold * 0.5, topK]
    );
    return r.rows.filter(r => r.similarity >= threshold);
}

function buildPrompt(chunks, question) {
    const ctx = chunks.map(c => `Article: ${c.title}\n${c.content}`).join("\n\n---\n\n");
    return {
        system: `You are a helpful customer support assistant.
        Answer using ONLY the information in the context below.
        If context does not contain enough information, say: "I do not have information about that."
        If context only partially answers, state what information is missing.
        Do not use any knowledge outside the provided context.`,
        user: `<context>\n${ctx}\n</context>\n\n<question>\n${question}\n</question>`
    };
}

async function embed(text) {
    const out = await embedder(
        text, { pooling: "mean", normalize: true }
    );
    return Array.from(out.data);
}

async function evaluateAnswerRelevancy(question, answer) {
    const res = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [{
            role: "system",
            content:
                "Generate 3 different questions that this answer "
                + "is responding to.\n"
                + "Respond in JSON: {\"questions\":[\"...\"]}"
        }, { role: "user", content: `Answer: ${answer}` }],
        temperature: 0, max_tokens: 200,
    });
    let generated;
    try {
        generated = JSON.parse(
            res.choices[0].message.content
        ).questions;
    } catch { return 0; }
    const origVec = await embed(question);
    const sims = await Promise.all(generated.map(async q => {
        const v = await embed(q);
        return origVec.reduce((sum, val, i) => sum + val * v[i], 0);
    }));
    return sims.reduce((a, b) => a + b, 0) / sims.length;
}

function evaluateContextPrecision(chunks, answer) {
    const ans = answer.toLowerCase();
    const cited = chunks.filter(c => ans.includes(c.title.toLowerCase())
        || c.content.split(" ").slice(0, 5)
            .some(w => ans.includes(w.toLowerCase()))
    );
    return chunks.length > 0
        ? cited.length / chunks.length : 1;
}

async function runEval() {
    const results = [];
    let passed = 0, failed = 0;
    for (const golden of goldenDataset) {
        if (golden.expectsError) continue;
        process.stdout.write(`Evaluating ${golden.id}... `);
        const chunks = await retrieve(golden.question);
        const retrieved = chunks.length > 0;
        if (retrieved !== golden.shouldRetrieve) {
            console.log(`FAIL (retrieval mismatch)`);
            results.push({ ...golden, retrievalFail: true });
            failed++; continue;
        }
        if (!retrieved) {
            console.log("OK (correct no-match)");
            passed++; continue;
        }
        const prompt = buildPrompt(chunks, golden.question);
        const res = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [
                { role: "system", content: prompt.system },
                { role: "user", content: prompt.user },
            ],
            temperature: 0, max_tokens: 300,
        });
        const answer = res.choices[0].message.content;
        const context = chunks.map(c => c.content).join("\n\n");
        const faithfulness = (
            await evaluateFaithfulness(
                golden.question, context, answer
            )
        ).faithfulness;
        const relevancy =
            await evaluateAnswerRelevancy(golden.question, answer);
        const precision =
            evaluateContextPrecision(chunks, answer);
        const pass =
            faithfulness >= 0.85 &&
            relevancy >= 0.80 &&
            precision >= 0.70;
        if (pass) passed++; else failed++;
        console.log(
            `${pass ? "OK" : "FAIL"} `
            + `(F:${faithfulness.toFixed(2)} `
            + `R:${relevancy.toFixed(2)} `
            + `P:${precision.toFixed(2)})`
        );
        results.push({
            id: golden.id, faithfulness, relevancy, precision, pass
        });
    }


    const n = results.filter(r => r.faithfulness != null).length;
    const avgF =
        results.reduce((a, r) => a + (r.faithfulness ?? 0), 0) / n;
    const avgR =
        results.reduce((a, r) => a + (r.relevancy ?? 0), 0) / n;
    const avgP =
        results.reduce((a, r) => a + (r.precision ?? 0), 0) / n;
    console.log("\n=== EVAL RESULTS ===");
    console.log(`Passed: ${passed}/${passed + failed}`);
    console.log(`Avg Faithfulness: ${avgF.toFixed(3)} (>=0.85)`);
    console.log(`Avg Relevancy: ${avgR.toFixed(3)} (>=0.80)`);
    console.log(`Avg Precision: ${avgP.toFixed(3)} (>=0.70)`);
    if (avgF < 0.85 || avgR < 0.80 || avgP < 0.70) {
        console.error("EVAL FAILED: thresholds not met.");
        process.exit(1);
    }
    console.log("EVAL PASSED: all thresholds met.");
}

await runEval();
await db.end();

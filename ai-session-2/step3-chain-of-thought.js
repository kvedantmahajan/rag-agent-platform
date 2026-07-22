import Groq from "groq-sdk";
import * as dotenv from "dotenv";
dotenv.config();
const client = new Groq({ apiKey: process.env.GROQ_API_KEY });
// Note: mid-tier model for reasoning. 8B is fine for classification;
// 70B produces more reliable logic on ambiguous multi-issue tickets.
const SYSTEM_PROMPT = `
You are a customer support ticket classifier for an e-commerce company.
For each ticket:
1. Think through the issue inside <reasoning> tags.
- What is the core problem?
- Are there multiple issues? If so, which is primary?
- How urgent is this based on language and context?
2. After the closing </reasoning> tag, output only the JSON object.
JSON fields:
- category: one of "billing", "technical", "account", "shipping", "other"
- confidence: a number between 0 and 1
- urgency: one of "low", "medium", "high"
- primary_issue: one sentence describing what the user actually needs
No text outside the reasoning tags and the JSON object.
`.trim();
async function classifyWithReasoning(ticket) {
    const response = await client.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: ticket },
        ], temperature: 0,
        max_tokens: 300,
    });
    const raw = response.choices[0].message.content;
    const match = raw.match(/<reasoning>([\s\S]*?)<\/reasoning>/);
    const reasoning = match ? match[1].trim() : "none";
    const jsonPart = raw.replace(/<reasoning>[\s\S]*?<\/reasoning>/, "").trim();
    return { reasoning, jsonPart };
}
const ambiguous = [
    "I cant log in and was charged for a subscription I cannot access. Day 3.",
    "Package arrived damaged and the return form on your website is broken.",
    "I think someone hacked my account -- orders I did not place, unknown charges.",
];
for (const ticket of ambiguous) {
    const { reasoning, jsonPart } = await classifyWithReasoning(ticket);
    console.log("Ticket: ", ticket);
    console.log("Reasoning:", reasoning);
    console.log("JSON: ", jsonPart);
    console.log("===\n");
}

// OBSERVE
// Read the reasoning blocks. Does the model identify the right primary issue when
// multiple problems exist? Notice the mid-tier model is used here -- for pure
// classification the 8B was fine, but for reasoning through ambiguous multi-issue
// inputs the 70B produces more reliable logic. This is the model-tier decision from
// Session 1 playing out in real code.
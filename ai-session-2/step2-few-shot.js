import Groq from "groq-sdk";
import * as dotenv from "dotenv";
dotenv.config();
const client = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_PROMPT = `
You are a customer support ticket classifier for an e-commerce company.
Given a support ticket, return a JSON object with exactly these fields:
- category: one of "billing", "technical", "account", "shipping", "other"
- confidence: a number between 0 and 1
- urgency: one of "low", "medium", "high"
Rules:
- Return only the JSON object. No explanation, no markdown, no code fences.
- Never invent information not present in the ticket.
- If unsure of category, use "other" and set confidence below 0.5.
Examples:
Input: "My payment was declined but I can see the charge on my bank statement."
Output: {"category":"billing","confidence":0.97,"urgency":"high"}
Input: "How do I change the email address on my account?"
Output: {"category":"account","confidence":0.95,"urgency":"low"}
`.trim();
async function classify(ticket) {
    const response = await client.chat.completions.create({
        model: "llama-3.1-8b-instant",
        messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: ticket },
        ],
        temperature: 0,
        max_tokens: 100,
    });
    return response.choices[0].message.content;
}
// Test with edge cases:
const edgeCases = ["URGENT!!! my order is 3 weeks late and nobody is responding!!!",
    "Hi, just wondering, do you guys have a student discount? No rush.",
    "Login not working. Also my last three orders were wrong items.",
];

for (const ticket of edgeCases) {
    const result = await classify(ticket);
    console.log("Ticket:", ticket.slice(0, 60) + "...");
    console.log("Result:", result);
    console.log("---");
}

// OBSERVE
// Compare confidence scores and urgency across the three edge cases. The URGENT ticket
// should be high. The casual inquiry should be low. The third ticket mentions two
// problems -- what does the model do? Notice how the examples guided it toward a
// decision.
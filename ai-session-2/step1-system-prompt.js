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
const tickets = [
    "I was charged twice for my order #4821. Please refund the duplicate charge.",
    "The app keeps crashing when I try to upload a photo. iPhone 14, iOS 17.",
    "I want to cancel my account and delete all my data.",
];

for (const ticket of tickets) {
    const result = await classify(ticket);
    console.log("Ticket:", ticket.slice(0, 60) + "...");
    console.log("Result:", result);
    console.log("---");
}
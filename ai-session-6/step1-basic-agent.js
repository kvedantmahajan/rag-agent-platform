import Groq from "groq-sdk";
import * as dotenv from "dotenv";
dotenv.config();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const tools = [
    {
        type: "function",
        function: {
            name: "searchKnowledgeBase",
            description: "Search the customer support knowledge base. "
                + "Use for questions about: refunds, cancellations, account management, "
                + "shipping, billing. Do NOT use for general knowledge, math, geography.",
            parameters: {
                type: "object",
                properties: {
                    query: {
                        type: "string",
                        description: "Specific query. refund policy for digital products beats refund."
                    }
                },
                required: ["query"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "getOrderStatus",
            description: "Look up order status by order ID. Use when customer mentions an order number.",
            parameters: {
                type: "object",
                properties: {
                    orderId: { type: "string", description: "The order ID from the user message." }
                },
                required: ["orderId"]
            }
        }
    }
];
const toolImplementations = {
    searchKnowledgeBase: async ({ query }) => {
        console.log(` [TOOL] searchKnowledgeBase("${query}")`);
        const results = {
            refund: "Refunds processed within 5-7 business days. Request within 30 days.",
            cancel: "Cancel anytime from Account Settings. Access continues until period end.",
            password: "Click Forgot Password. Reset link expires in 24 hours.",
        };
        const key = Object.keys(results).find(k => query.toLowerCase().includes(k));
        return key ? { found: true, content: results[key] } : { found: false };
    },
    getOrderStatus: async ({ orderId }) => {
        console.log(` [TOOL] getOrderStatus("${orderId}")`);
        const orders = {
            "4821": { status: "delivered", daysAgo: 3, eligible: true },
            "1234": { status: "shipped", daysAgo: 0, eligible: false },
        };
        const o = orders[orderId];
        return o ? { found: true, orderId, ...o } : { found: false };
    },
};
async function runAgent(userMessage) {
    console.log(`\nUser: "${userMessage}"`);
    const messages = [
        {
            role: "system", content: "You are a helpful customer support assistant. "
                + "Use tools to look up information before answering. "
                + "Always check the knowledge base for policy questions. "
                + "Always check order status when user mentions an order number."
        },
        { role: "user", content: userMessage }
    ];
    let step = 0;
    while (true) {
        step++;
        const response = await groq.chat.completions.create({
            // Groq tool-use preview models were decommissioned; use production Llama 3.3
            model: "llama-3.3-70b-versatile",
            messages, tools, tool_choice: "auto", temperature: 0, max_tokens: 500
        });
        const msg = response.choices[0].message;
        messages.push(msg);
        if (!msg.tool_calls?.length) {
            console.log(`\nAgent (${step} steps): ${msg.content}`);
            return msg.content;
        }
        for (const tc of msg.tool_calls) {
            const args = JSON.parse(tc.function.arguments);
            const result = await toolImplementations[tc.function.name](args);
            messages.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(result) });
        }
        if (step >= 5) { console.log("[Max steps]"); break; }
    }
}
await runAgent("How do I get a refund for order #4821?");
await runAgent("Hi, what is the capital of France?");
await runAgent("My order #1234 arrived broken, what are my options?");
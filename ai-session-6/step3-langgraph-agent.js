import {
    StateGraph,
    Annotation,
    messagesStateReducer,
    END,
    START,
} from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { ChatGroq } from "@langchain/groq";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import * as dotenv from "dotenv";
dotenv.config();

const MAX_TOOL_STEPS = 5;

const AgentState = Annotation.Root({
    messages: Annotation({
        reducer: messagesStateReducer,
        default: () => [],
    }),
    toolSteps: Annotation({
        reducer: (_left, right) => right,
        default: () => 0,
    }),
});

const searchKnowledgeBase = tool(
    async ({ query }) => {
        const results = {
            refund: "Refunds processed within 5-7 business days. Request within 30 days.",
            cancel: "Cancel anytime from Account Settings.",
            password: "Click Forgot Password. Reset link expires in 24 hours.",
        };
        const key = Object.keys(results).find(k => query.toLowerCase().includes(k));
        return key ? results[key] : "No relevant article found.";
    },
    {
        name: "searchKnowledgeBase",
        description: "Search the customer support knowledge base. Use for policy questions "
            + "about refunds, cancellations, account management, billing. "
            + "Do NOT use for general knowledge questions.",
        schema: z.object({ query: z.string().describe("Specific search query") })
    }
);

const getOrderStatus = tool(
    async ({ orderId }) => {
        const orders = {
            "4821": { status: "delivered", daysAgo: 3, refundEligible: true },
            "1234": { status: "shipped", daysAgo: 0, refundEligible: false },
        };
        const o = orders[orderId];
        return o ? JSON.stringify({ orderId, ...o }) : `Order ${orderId} not found.`;
    },
    {
        name: "getOrderStatus",
        description: "Look up order status by order ID. Use when user mentions an order number.",
        schema: z.object({ orderId: z.string().describe("The order ID") })
    }
);

const tools = [searchKnowledgeBase, getOrderStatus];
// llama-3.3-70b-versatile often emits malformed <function=...> text instead of native tool calls
const model = new ChatGroq({ model: "openai/gpt-oss-20b", temperature: 0 })
    .bindTools(tools);
const toolNode = new ToolNode(tools);

function shouldContinue(state) {
    const last = state.messages.at(-1);
    if (!last.tool_calls?.length) return END;
    if ((state.toolSteps ?? 0) >= MAX_TOOL_STEPS) return END;
    return "tools";
}

async function callModel(state) {
    const response = await model.invoke([
        {
            role: "system",
            content: "You are a helpful customer support assistant. "
                + "Use tools to look up information. Verify order status and policies before answering."
        },
        ...state.messages
    ]);
    return { messages: [response] };
}

async function runTools(state) {
    const result = await toolNode.invoke(state);
    return {
        ...result,
        toolSteps: (state.toolSteps ?? 0) + 1,
    };
}

const app = new StateGraph(AgentState)
    .addNode("agent", callModel)
    .addNode("tools", runTools)
    .addEdge(START, "agent")
    .addConditionalEdges("agent", shouldContinue)
    .addEdge("tools", "agent")
    .compile();

async function run(msg) {
    console.log(`\nUser: "${msg}"`);
    const result = await app.invoke({ messages: [{ role: "user", content: msg }] });
    console.log("Agent:", result.messages.at(-1).content);
}
await run("What is the refund policy and can I refund order #4821?");
await run("How are you today?");

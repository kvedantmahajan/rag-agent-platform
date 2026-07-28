import {
    StateGraph,
    Annotation,
    messagesStateReducer,
    END,
    START,
    interrupt,
    Command,
    INTERRUPT,
    MemorySaver,
} from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { ChatGroq } from "@langchain/groq";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import * as readline from "readline/promises";
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

// Read-only tool -- no approval needed
const getOrderStatus = tool(
    async ({ orderId }) => {
        const orders = { "4821": { status: "delivered", daysAgo: 3, refundEligible: true, amount: 49.99 } };
        const o = orders[orderId];
        return o ? JSON.stringify({ orderId, ...o }) : `Order ${orderId} not found.`;
    },
    {
        name: "getOrderStatus",
        description: "Look up order status. Safe -- read only.",
        schema: z.object({ orderId: z.string() })
    }
);
// Irreversible tool -- requires human approval
const processRefund = tool(
    async ({ orderId, amount }) => {
        console.log(` [processRefund] Processing $${amount} refund for order ${orderId}`);
        return `Refund of $${amount} for order ${orderId} submitted successfully.`;
    },
    {
        name: "processRefund",
        description: "Process a refund. ONLY use after confirming eligibility. Irreversible.",
        schema: z.object({
            orderId: z.string(), amount: z.number().describe("Refund amount in dollars")
        })
    }
);
const tools = [getOrderStatus, processRefund];
const toolNode = new ToolNode(tools);

const model = new ChatGroq({ model: "openai/gpt-oss-20b", temperature: 0 })
    .bindTools(tools);

async function humanApproval(state) {
    const last = state.messages.at(-1);
    const refundCalls = last.tool_calls?.filter(
        tc => tc.name === "processRefund"
    ) ?? [];
    if (!refundCalls.length) return {};
    const r = refundCalls[0].args;
    // interrupt() saves graph state and pauses here
    const decision = interrupt(
        `APPROVAL REQUIRED\n`
        + `Order: ${r.orderId}\n`
        + `Amount: $${r.amount}\n`
        + `Approve? (yes/no)`
    );
    if (decision !== "yes") {
        return {
            messages: [
                {
                    role: "tool",
                    tool_call_id: refundCalls[0].id,
                    content: "Refund rejected by support agent.",
                },
            ],
        };
    }
    return {};
}

function shouldContinue(state) {
    const last = state.messages.at(-1);
    if (!last.tool_calls?.length) return END;
    if ((state.toolSteps ?? 0) >= MAX_TOOL_STEPS) return END;
    if (last.tool_calls.some((tc) => tc.name === "processRefund")) return "approval";
    return "tools";
}

async function callModel(state) {
    const r = await model.invoke([
        {
            role: "system",
            content:
                "You are a support assistant. "
                + "Verify order eligibility before processing refunds."
        },
        ...state.messages,
    ]);
    return { messages: [r] };
}

async function runTools(state) {
    const result = await toolNode.invoke(state);
    return {
        ...result,
        toolSteps: (state.toolSteps ?? 0) + 1,
    };
}

// MemorySaver stores state in memory (single process).
// Production: replace with PostgresSaver.
const checkpointer = new MemorySaver();
const app = new StateGraph(AgentState)
    .addNode("agent", callModel)
    .addNode("approval", humanApproval)
    .addNode("tools", runTools)
    .addEdge(START, "agent")
    .addConditionalEdges("agent", shouldContinue)
    .addEdge("approval", "tools")
    .addEdge("tools", "agent")
    .compile({ checkpointer });
const config = { configurable: { thread_id: "support-1" } };
const rl = readline.createInterface({
    input: process.stdin, output: process.stdout
});

async function chat(msg) {
    let result = await app.invoke(
        { messages: [{ role: "user", content: msg }] },
        config
    );
    // LangGraph interrupt() returns __interrupt__ — it does not throw
    while (result[INTERRUPT]?.length) {
        console.log("\n" + result[INTERRUPT][0].value);
        const answer = await rl.question("Your decision: ");
        result = await app.invoke(new Command({ resume: answer.trim() }), config);
    }
    console.log("Agent:", result?.messages?.at(-1)?.content);
}
await chat("Please process a refund for my order #4821");
rl.close();

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
import { BaseMessage, HumanMessage } from "@langchain/core/messages";
import { z } from "zod";
import * as dotenv from "dotenv";

dotenv.config();
dotenv.config({ path: ".env.local", override: true });

const MAX_TOOL_STEPS = 5;

const AgentState = Annotation.Root({
    messages: Annotation<BaseMessage[]>({
        reducer: messagesStateReducer,
        default: () => [],
    }),
    toolSteps: Annotation<number>({
        reducer: (_left, right) => right,
        default: () => 0,
    }),
});

type AgentStateType = typeof AgentState.State;

const getOrderStatus = tool(
    async ({ orderId }) => {
        const orders: Record<
            string,
            { status: string; daysAgo: number; refundEligible: boolean; amount: number }
        > = {
            "4821": {
                status: "delivered",
                daysAgo: 3,
                refundEligible: true,
                amount: 49.99,
            },
        };
        const o = orders[orderId];
        return o
            ? JSON.stringify({ orderId, ...o })
            : `Order ${orderId} not found.`;
    },
    {
        name: "getOrderStatus",
        description: "Look up order status. Safe -- read only.",
        schema: z.object({ orderId: z.string() }),
    },
);

const processRefund = tool(
    async ({ orderId, amount }) => {
        console.log(
            ` [processRefund] Processing $${amount} refund for order ${orderId}`,
        );
        return `Refund of $${amount} for order ${orderId} submitted successfully.`;
    },
    {
        name: "processRefund",
        description:
            "Process a refund. ONLY use after confirming eligibility. Irreversible.",
        schema: z.object({
            orderId: z.string(),
            amount: z.number().describe("Refund amount in dollars"),
        }),
    },
);

const tools = [getOrderStatus, processRefund];
const toolNode = new ToolNode(tools);

const model = new ChatGroq({
    // Prefer Groq id — do not reuse Ollama LLM_MODEL from .env.local
    model: process.env.GROQ_MODEL ?? "openai/gpt-oss-20b",
    temperature: 0,
}).bindTools(tools);

async function humanApproval(state: AgentStateType) {
    const last = state.messages.at(-1) as {
        tool_calls?: Array<{ name: string; args: { orderId: string; amount: number }; id: string }>;
    };
    const refundCalls =
        last.tool_calls?.filter((tc) => tc.name === "processRefund") ?? [];
    if (!refundCalls.length) return {};

    const r = refundCalls[0].args;
    const decision = interrupt({
        prompt: "APPROVAL REQUIRED",
        orderId: r.orderId,
        amount: r.amount,
        message: `Approve refund of $${r.amount} for order ${r.orderId}? (yes/no)`,
    });

    if (decision !== "yes") {
        return {
            messages: [
                {
                    role: "tool" as const,
                    tool_call_id: refundCalls[0].id,
                    content: "Refund rejected by support agent.",
                },
            ],
        };
    }
    return {};
}

function shouldContinue(state: AgentStateType) {
    const last = state.messages.at(-1) as {
        tool_calls?: Array<{ name: string }>;
    };
    if (!last.tool_calls?.length) return END;
    if ((state.toolSteps ?? 0) >= MAX_TOOL_STEPS) return END;
    if (last.tool_calls.some((tc) => tc.name === "processRefund")) {
        return "approval";
    }
    return "tools";
}

async function callModel(state: AgentStateType) {
    const response = await model.invoke([
        {
            role: "system",
            content:
                "You are a support assistant. "
                + "Verify order eligibility before processing refunds.",
        },
        ...state.messages,
    ]);
    return { messages: [response] };
}

async function runTools(state: AgentStateType) {
    const result = await toolNode.invoke(state);
    return {
        ...result,
        toolSteps: (state.toolSteps ?? 0) + 1,
    };
}

const checkpointer = new MemorySaver();

export const supportAgent = new StateGraph(AgentState)
    .addNode("agent", callModel)
    .addNode("approval", humanApproval)
    .addNode("tools", runTools)
    .addEdge(START, "agent")
    .addConditionalEdges("agent", shouldContinue)
    .addEdge("approval", "tools")
    .addEdge("tools", "agent")
    .compile({ checkpointer });

export type AgentResponse =
    | {
        status: "approval_required";
        threadId: string;
        approval: {
            prompt: string;
            orderId: string;
            amount: number;
            message: string;
        };
    }
    | {
        status: "done";
        threadId: string;
        reply: string;
    };

function threadConfig(threadId: string) {
    return { configurable: { thread_id: threadId } };
}

function toResponse(threadId: string, result: Record<string, unknown>): AgentResponse {
    const interrupts = result[INTERRUPT] as
        | Array<{
            value: AgentResponse extends { status: "approval_required" } ?
            AgentResponse["approval"] : unknown
        }>
        | undefined;

    if (interrupts?.length) {
        const value = interrupts[0].value as {
            prompt: string;
            orderId: string;
            amount: number;
            message: string;
        };
        return {
            status: "approval_required",
            threadId,
            approval: value,
        };
    }

    const messages = result.messages as Array<{ content?: unknown }>;
    const last = messages?.at(-1);
    const content = last?.content;
    const reply =
        typeof content === "string"
            ? content
            : Array.isArray(content)
                ? content
                    .map((part) =>
                        typeof part === "string"
                            ? part
                            : (part as { text?: string }).text ?? "",
                    )
                    .join("")
                : String(content ?? "");

    return { status: "done", threadId, reply };
}

export async function startChat(
    threadId: string,
    message: string,
): Promise<AgentResponse> {
    const result = await supportAgent.invoke(
        { messages: [new HumanMessage(message)] },
        threadConfig(threadId),
    );
    return toResponse(threadId, result as Record<string, unknown>);
}

export async function resumeChat(
    threadId: string,
    decision: string,
): Promise<AgentResponse> {
    const result = await supportAgent.invoke(
        new Command({ resume: decision.trim() }),
        threadConfig(threadId),
    );
    return toResponse(threadId, result as Record<string, unknown>);
}

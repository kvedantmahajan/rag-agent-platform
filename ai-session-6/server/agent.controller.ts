import { Body, Controller, Post } from "@nestjs/common";
import { resumeChat, startChat } from "./support-agent.js";

@Controller("agent")
export class AgentController {
    @Post("chat")
    async chat(
        @Body()
        body: { threadId?: string; message: string },
    ) {
        const threadId = body.threadId?.trim() || crypto.randomUUID();
        if (!body.message?.trim()) {
            return { status: "error", error: "message is required" };
        }
        return startChat(threadId, body.message.trim());
    }

    @Post("resume")
    async resume(
        @Body()
        body: { threadId: string; decision: string },
    ) {
        if (!body.threadId?.trim()) {
            return { status: "error", error: "threadId is required" };
        }
        if (!body.decision?.trim()) {
            return { status: "error", error: "decision is required" };
        }
        return resumeChat(body.threadId.trim(), body.decision.trim());
    }
}

import { Module } from "@nestjs/common";
import { ChatController } from "./chat.controller.js";
import { KnowledgeBaseService } from "./knowledge-base.service.js";
import { RagToolsService } from "./rag-tools.service.js";

@Module({
    controllers: [ChatController],
    providers: [KnowledgeBaseService, RagToolsService],
})
export class AppModule {}

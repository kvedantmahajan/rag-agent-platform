import { Module } from "@nestjs/common";
import { KnowledgeBaseService } from "./knowledge-base.service.js";
import { RagController } from "./step4-rag-controller.js";

@Module({
    controllers: [RagController],
    providers: [KnowledgeBaseService],
})
export class AppModule {}

import { Module } from "@nestjs/common";
import { KnowledgeBaseService } from "./knowledge-base.service.js";

@Module({
    providers: [KnowledgeBaseService],
    exports: [KnowledgeBaseService],
})
export class AppModule {}

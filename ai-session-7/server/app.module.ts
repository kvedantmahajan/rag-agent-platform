import { Module } from "@nestjs/common";
import { KnowledgeBaseService } from "./knowledge-base.service.js";
import { HealthController } from "./health.controller.js";
import { ProductionRagController } from "./step4-production-controller.js";

@Module({
    controllers: [HealthController, ProductionRagController],
    providers: [KnowledgeBaseService],
    exports: [KnowledgeBaseService],
})
export class AppModule {}

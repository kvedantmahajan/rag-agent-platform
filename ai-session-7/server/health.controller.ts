import { Controller, Get } from "@nestjs/common";

@Controller("health")
export class HealthController {
    @Get()
    check() {
        return {
            status: "ok",
            timestamp: new Date().toISOString(),
            embeddingModel: "Xenova/all-MiniLM-L6-v2",
        };
    }
}

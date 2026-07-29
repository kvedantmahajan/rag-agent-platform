import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import * as dotenv from "dotenv";
import { AppModule } from "./app.module.js";
import { initLangfuseFromEnv, shutdownLangfuse } from "./langfuse.js";

dotenv.config();
dotenv.config({ path: ".env.local", override: true });

async function bootstrap() {
    const required = ["GROQ_API_KEY", "DATABASE_URL"];
    const missing = required.filter((k) => !process.env[k]);
    if (missing.length > 0) {
        console.error(`Missing required env vars: ${missing.join(", ")}`);
        process.exit(1);
    }

    initLangfuseFromEnv();

    const app = await NestFactory.create(AppModule);

    const origins = [
        process.env.FRONTEND_URL,
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ].filter((o): o is string => Boolean(o && o.trim()));

    app.enableCors({
        origin: origins,
        methods: ["GET", "POST", "OPTIONS"],
        credentials: false,
    });

    const port = Number(process.env.PORT ?? process.env.API_PORT ?? 3001);
    await app.listen(port);
    console.log(`NestJS running on port ${port}`);

    const stop = async () => {
        await shutdownLangfuse();
        await app.close();
        process.exit(0);
    };
    process.once("SIGINT", () => void stop());
    process.once("SIGTERM", () => void stop());
}

bootstrap();

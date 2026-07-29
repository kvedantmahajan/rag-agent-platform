import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import * as dotenv from "dotenv";
import { AppModule } from "./app.module.js";

dotenv.config();
dotenv.config({ path: ".env.local", override: true });

async function bootstrap() {
    const required = ["GROQ_API_KEY", "DATABASE_URL"];
    const missing = required.filter((k) => !process.env[k]);
    if (missing.length > 0) {
        console.error(`Missing required env vars: ${missing.join(", ")}`);
        process.exit(1);
    }

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

    // Render sets PORT automatically — never hardcode
    // Local default 3001 matches lib/api.ts NEXT_PUBLIC_API_URL fallback
    const port = Number(process.env.PORT ?? process.env.API_PORT ?? 3001);
    await app.listen(port);
    console.log(`NestJS running on port ${port}`);
}

bootstrap();

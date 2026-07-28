import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import * as dotenv from "dotenv";
import { AppModule } from "./app.module.js";

dotenv.config();
dotenv.config({ path: ".env.local", override: true });

async function bootstrap() {
    const app = await NestFactory.create(AppModule);
    app.enableCors({
        origin: ["http://localhost:3001", "http://127.0.0.1:3001"],
        methods: ["GET", "POST", "OPTIONS"],
    });
    const port = Number(process.env.API_PORT ?? 3000);
    await app.listen(port);
    console.log(`Session 6 API listening on http://localhost:${port}`);
    console.log("POST /agent/chat | /agent/resume");
}

bootstrap();

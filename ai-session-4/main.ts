import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import * as dotenv from "dotenv";
import { AppModule } from "./app.module.js";

dotenv.config();

async function bootstrap() {
    const app = await NestFactory.create(AppModule);
    await app.listen(3000);
    console.log("RAG API listening on http://localhost:3000");
    console.log("POST /rag/query  { \"question\": \"...\" }");
}

bootstrap();

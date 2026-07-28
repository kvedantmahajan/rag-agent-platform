import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import * as dotenv from "dotenv";
import { AppModule } from "./app.module.js";

dotenv.config();
dotenv.config({ path: ".env.local", override: true });

async function bootstrap() {
    const app = await NestFactory.create(AppModule);
    const port = Number(process.env.API_PORT ?? 3000);
    await app.listen(port);
    console.log(`Session 7 API listening on http://localhost:${port}`);
}

bootstrap();

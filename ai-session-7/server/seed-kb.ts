/**
 * CLI seed via Nest application context (same KnowledgeBaseService as API boot).
 *
 *   npm run seed:kb          # seed if empty
 *   npm run seed:kb -- --force
 */
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import * as dotenv from "dotenv";
import { AppModule } from "./app.module.js";
import { KnowledgeBaseService } from "./knowledge-base.service.js";

dotenv.config();
dotenv.config({ path: ".env.local", override: true });

const force = process.argv.includes("--force");

const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["log", "error", "warn"],
});
const kb = app.get(KnowledgeBaseService);
// onModuleInit may have already seeded if empty; --force reloads from JSON
const n = await kb.seedFromFixture({ force });
console.log(force ? `Re-seeded ${n} articles from fixtures/kb-articles.json` : `KB ready (${n} articles)`);
await app.close();

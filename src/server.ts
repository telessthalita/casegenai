import { existsSync } from "node:fs";
import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { GeradorComFallback, GeradorGemini, GeradorTemplate } from "./generators.js";
import { MemoryStore } from "./store.js";

if (existsSync(".env")) process.loadEnvFile(".env");

const apiKey = process.env.GEMINI_API_KEY?.trim();
const modo = apiKey ? "gemini" : "demo";
const gerador = apiKey
  ? new GeradorComFallback(new GeradorGemini(apiKey, process.env.GEMINI_MODEL?.trim() || undefined))
  : new GeradorTemplate();

const app = createApp({
  store: new MemoryStore(),
  gerador,
  modo,
  rateLimitPorHora: Number(process.env.RATE_LIMIT) || 20,
});

const port = Number(process.env.PORT) || 8080;
serve({ fetch: app.fetch, port }, () => {
  console.log(`CaseGenAI rodando em http://localhost:${port} (modo ${modo})`);
  if (modo === "demo") console.log("Sem GEMINI_API_KEY: os cases saem do template. Veja o README.");
});

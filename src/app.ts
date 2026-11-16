import { Hono } from "hono";
import { html } from "hono/html";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import { bodyLimit } from "hono/body-limit";
import { serveStatic } from "@hono/node-server/serve-static";
import { caseInputSchema } from "./schema.js";
import { calcularDestaques, formatarNumero, nomeLegivel } from "./metrics.js";
import type { Gerador } from "./generators.js";
import { type CaseStudy, type Store, novoId } from "./store.js";
import { rateLimit } from "./rate-limit.js";

export interface AppDeps {
  store: Store;
  gerador: Gerador;
  modo: "gemini" | "demo";
  rateLimitPorHora?: number;
  log?: boolean;
}

export function createApp({ store, gerador, modo, rateLimitPorHora = 20, log = true }: AppDeps) {
  const app = new Hono();

  if (log) app.use(logger());
  app.use(
    secureHeaders({
      contentSecurityPolicy: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "https://fonts.googleapis.com"],
        fontSrc: ["https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:"],
        scriptSrc: ["'self'"],
      },
    }),
  );

  app.get("/api", (c) =>
    c.json({ status: "success", message: "CaseGenAI API está funcionando!", modo }),
  );
  app.get("/api/health", (c) => c.json({ ok: true }));

  app.post(
    "/api/case",
    bodyLimit({
      maxSize: 16 * 1024,
      onError: (c) => c.json({ status: "error", message: "Corpo da requisição grande demais" }, 413),
    }),
    rateLimit({ limite: rateLimitPorHora, janelaMs: 60 * 60 * 1000 }),
    async (c) => {
      let body: unknown;
      try {
        body = await c.req.json();
      } catch {
        return c.json({ status: "error", message: "Envie um JSON válido" }, 400);
      }
      const parsed = caseInputSchema.safeParse(body);
      if (!parsed.success) {
        return c.json(
          {
            status: "error",
            message: "Dados inválidos",
            erros: parsed.error.issues.map((i) => ({ campo: i.path.join("."), erro: i.message })),
          },
          422,
        );
      }

      const input = parsed.data;
      const destaques = calcularDestaques(input.metricas);
      const gerado = await gerador.gerar(input, destaques);
      const caso: CaseStudy = {
        id: novoId(input.startup_nome),
        ...input,
        ...gerado,
        destaques,
        created_at: new Date().toISOString(),
      };
      await store.salvar(caso);

      return c.json(
        {
          status: "success",
          message: "Case gerado com sucesso",
          data: { ...caso, url: `/case/${caso.id}` },
        },
        201,
      );
    },
  );

  app.get("/api/case/:id", async (c) => {
    const caso = await store.buscar(c.req.param("id"));
    if (!caso) return c.json({ status: "error", message: "Case não encontrado" }, 404);
    return c.json({ status: "success", data: caso });
  });

  app.get("/case/:id", async (c) => {
    const caso = await store.buscar(c.req.param("id"));
    if (!caso) {
      return c.html(paginaCase(null), 404);
    }
    return c.html(paginaCase(caso));
  });

  app.use("/*", serveStatic({ root: "./public" }));

  app.notFound((c) => c.json({ status: "error", message: "Rota não encontrada" }, 404));
  app.onError((err, c) => {
    console.error(err);
    return c.json({ status: "error", message: "Deu ruim aqui do nosso lado. Tenta de novo?" }, 500);
  });

  return app;
}

function paginaCase(caso: CaseStudy | null) {
  const titulo = caso ? caso.titulo : "Case não encontrado";
  return html`<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${titulo} · CaseGenAI</title>
    <link rel="stylesheet" href="/style.css" />
  </head>
  <body>
    <main class="wrap case">
      <a class="voltar" href="/">← gerar outro case</a>
      ${caso
        ? html`<p class="tag">${caso.setor ?? "case"}${caso.periodo ? ` · ${caso.periodo}` : ""}</p>
            <h1>${caso.titulo}</h1>
            ${caso.destaques.length
              ? html`<ul class="destaques">
                  ${caso.destaques.map(
                    (d) =>
                      html`<li>
                        <strong>${d.variacao_pct === null ? "novo" : `${d.variacao_pct >= 0 ? "+" : ""}${formatarNumero(d.variacao_pct)}%`}</strong>
                        <span>${nomeLegivel(d.metrica)}</span>
                      </li>`,
                  )}
                </ul>`
              : ""}
            <article>${caso.texto.split(/\n\s*\n/).map((p) => html`<p>${p}</p>`)}</article>
            <p class="rodape">
              Gerado ${caso.fonte === "gemini" ? "com Gemini" : "em modo demo (template)"} pelo CaseGenAI
            </p>`
        : html`<h1>Esse case não existe (ou já sumiu)</h1>
            <p>Os cases da demo ficam na memória e somem quando o servidor reinicia.</p>`}
    </main>
  </body>
</html>`;
}

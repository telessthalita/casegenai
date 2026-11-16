import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import {
  GeradorComFallback,
  GeradorGemini,
  GeradorTemplate,
  type Gerador,
} from "../src/generators.js";
import { calcularDestaques } from "../src/metrics.js";
import { MemoryStore, slugify } from "../src/store.js";

const exemplo = {
  startup_nome: "FitTrack",
  setor: "saúde",
  metricas: { usuarios_antes: 1000, usuarios_depois: 4500, receita_antes: 5000, receita_depois: 22000 },
};

function app(gerador: Gerador = new GeradorTemplate(), rateLimitPorHora = 20) {
  return createApp({ store: new MemoryStore(), gerador, modo: "demo", rateLimitPorHora, log: false });
}

const post = (a: ReturnType<typeof app>, body: unknown) =>
  a.request("/api/case", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

describe("métricas", () => {
  it("calcula crescimento dos pares antes/depois", () => {
    const d = calcularDestaques(exemplo.metricas);
    expect(d).toEqual([
      { metrica: "receita", antes: 5000, depois: 22000, variacao_pct: 340, multiplicador: 4.4 },
      { metrica: "usuarios", antes: 1000, depois: 4500, variacao_pct: 350, multiplicador: 4.5 },
    ].sort((a, b) => b.variacao_pct - a.variacao_pct));
  });

  it("lida com valor inicial zero", () => {
    const [d] = calcularDestaques({ vendas_antes: 0, vendas_depois: 10 });
    expect(d.variacao_pct).toBeNull();
  });

  it("slugify tira acento e símbolo", () => {
    expect(slugify("Saúde & Ação!")).toBe("saude-acao");
  });
});

describe("API", () => {
  it("GET /api responde status", async () => {
    const res = await app().request("/api");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "success", modo: "demo" });
  });

  it("cria e consulta um case", async () => {
    const a = app();
    const res = await post(a, exemplo);
    expect(res.status).toBe(201);
    const { data } = await res.json();
    expect(data.id).toMatch(/^fittrack-[a-z0-9]{8}$/);
    expect(data.url).toBe(`/case/${data.id}`);
    expect(data.texto).toContain("FitTrack");
    expect(data.texto).not.toContain("—");
    expect(data.fonte).toBe("template");

    const get = await a.request(`/api/case/${data.id}`);
    expect(get.status).toBe(200);
    expect((await get.json()).data.titulo).toBe(data.titulo);

    const pagina = await a.request(data.url);
    expect(pagina.status).toBe(200);
    expect(await pagina.text()).toContain("FitTrack");
  });

  it("escapa HTML na página do case", async () => {
    const a = app();
    const { data } = await (await post(a, { ...exemplo, startup_nome: "<script>x</script>" })).json();
    const html = await (await a.request(data.url)).text();
    expect(html).not.toContain("<script>x</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("valida o corpo", async () => {
    const a = app();
    expect((await post(a, "{nao é json")).status).toBe(400);
    const r = await post(a, { startup_nome: "", metricas: {} });
    expect(r.status).toBe(422);
    expect((await r.json()).erros.length).toBeGreaterThan(0);
    expect((await post(a, { ...exemplo, metricas: { "Receita Bruta": 1 } })).status).toBe(422);
    expect((await post(a, { ...exemplo, extra: 1 })).status).toBe(422);
    expect((await post(a, { ...exemplo, metricas: { a_antes: -1 } })).status).toBe(422);
  });

  it("404 pra case inexistente", async () => {
    expect((await app().request("/api/case/nada")).status).toBe(404);
  });

  it("aplica rate limit", async () => {
    const a = app(new GeradorTemplate(), 2);
    expect((await post(a, exemplo)).status).toBe(201);
    expect((await post(a, exemplo)).status).toBe(201);
    const r = await post(a, exemplo);
    expect(r.status).toBe(429);
    expect(r.headers.get("retry-after")).toBeTruthy();
  });

  it("serve a página de teste", async () => {
    const res = await app().request("/");
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("CaseGenAI");
  });
});

describe("Gemini", () => {
  const respostaGemini = (obj: unknown, status = 200) =>
    vi.fn(async () =>
      new Response(
        JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }] }),
        { status },
      ),
    );

  it("monta a chamada e lê a resposta", async () => {
    const fetchFn = respostaGemini({ titulo: "Título — bom", resumo: "r", texto: "p1\n\np2" });
    const g = new GeradorGemini("chave", "gemini-teste", fetchFn as unknown as typeof fetch);
    const out = await g.gerar(exemplo, calcularDestaques(exemplo.metricas));
    expect(out).toEqual({ titulo: "Título, bom", resumo: "r", texto: "p1\n\np2", fonte: "gemini" });

    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("models/gemini-teste:generateContent");
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("chave");
    expect(String(init.body)).toContain("FitTrack");
  });

  it("cai pro template quando o Gemini falha", async () => {
    const fetchFn = vi.fn(async () => new Response("quota", { status: 429 }));
    const g = new GeradorComFallback(
      new GeradorGemini("chave", undefined, fetchFn as unknown as typeof fetch),
      new GeradorTemplate(),
      () => {},
    );
    const res = await post(app(g), exemplo);
    expect(res.status).toBe(201);
    expect((await res.json()).data.fonte).toBe("template");
  });
});

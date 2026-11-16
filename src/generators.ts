import type { CaseInput } from "./schema.js";
import { type Destaque, formatarNumero, nomeLegivel } from "./metrics.js";

export interface TextoGerado {
  titulo: string;
  resumo: string;
  texto: string;
  fonte: "gemini" | "template";
}

export interface Gerador {
  gerar(input: CaseInput, destaques: Destaque[]): Promise<TextoGerado>;
}

function descreverDestaque(d: Destaque): string {
  const base = `${nomeLegivel(d.metrica)} foi de ${formatarNumero(d.antes)} para ${formatarNumero(d.depois)}`;
  if (d.variacao_pct === null) return `${base} (saiu do zero)`;
  return `${base} (${d.variacao_pct >= 0 ? "+" : ""}${formatarNumero(d.variacao_pct)}%)`;
}

export function montarPrompt(input: CaseInput, destaques: Destaque[]): string {
  const linhas = [
    "Você escreve cases de sucesso de startups em português do Brasil.",
    "Escreva um case curto e persuasivo usando SOMENTE os dados abaixo. Não invente números, clientes, prêmios nem citações.",
    "Tom: profissional, direto e humano. Nada de clichê de marketing. Não use travessão (—).",
    "Estrutura do texto: o ponto de partida, o que mudou, os resultados com os números, e um fechamento.",
    "Entre 3 e 5 parágrafos, separados por linha em branco, sem markdown.",
    "",
    `Startup: ${input.startup_nome}`,
  ];
  if (input.setor) linhas.push(`Setor: ${input.setor}`);
  if (input.periodo) linhas.push(`Período: ${input.periodo}`);
  if (input.contexto) linhas.push(`Contexto informado pela startup: ${input.contexto}`);
  linhas.push("Métricas brutas:");
  for (const [k, v] of Object.entries(input.metricas)) linhas.push(`- ${nomeLegivel(k)}: ${v}`);
  if (destaques.length) {
    linhas.push("Crescimento já calculado (use esses números):");
    for (const d of destaques) linhas.push(`- ${descreverDestaque(d)}`);
  }
  return linhas.join("\n");
}

export class GeradorTemplate implements Gerador {
  async gerar(input: CaseInput, destaques: Destaque[]): Promise<TextoGerado> {
    const nome = input.startup_nome;
    const principal = destaques[0];
    const titulo = principal?.multiplicador
      ? `${nome}: ${formatarNumero(principal.multiplicador)}x mais ${nomeLegivel(principal.metrica)}`
      : `${nome}: os números de uma virada`;

    const quando = input.periodo ? ` em ${input.periodo}` : "";
    const setor = input.setor ? `, do setor de ${input.setor},` : "";
    const contexto = input.contexto?.replace(/[.!\s]+$/, "");
    const paragrafos = [
      `A ${nome}${setor} tinha um desafio comum: crescer sem perder o controle do negócio.${contexto ? ` A virada veio com uma decisão clara: ${contexto.charAt(0).toLowerCase()}${contexto.slice(1)}.` : ""}`,
      destaques.length
        ? `Os resultados${quando} falam por si: ${destaques.map(descreverDestaque).join("; ")}.`
        : `Os números${quando}: ${Object.entries(input.metricas)
            .map(([k, v]) => `${nomeLegivel(k)} em ${formatarNumero(v)}`)
            .join("; ")}.`,
      `Mais do que crescimento, a ${nome} mostrou consistência. E é esse tipo de resultado que vira referência pra quem está começando.`,
    ];
    return {
      titulo,
      resumo: paragrafos[1],
      texto: paragrafos.join("\n\n"),
      fonte: "template",
    };
  }
}

export class GeradorGemini implements Gerador {
  constructor(
    private apiKey: string,
    private model = "gemini-2.5-flash",
    private fetchFn: typeof fetch = fetch,
  ) {}

  async gerar(input: CaseInput, destaques: Destaque[]): Promise<TextoGerado> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent`;
    const res = await this.fetchFn(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": this.apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: montarPrompt(input, destaques) }] }],
        generationConfig: {
          temperature: 0.8,
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              titulo: { type: "STRING", description: "título curto e chamativo, até 80 caracteres" },
              resumo: { type: "STRING", description: "uma frase de resumo do case" },
              texto: { type: "STRING", description: "o case completo, parágrafos separados por linha em branco" },
            },
            required: ["titulo", "resumo", "texto"],
          },
        },
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      const corpo = await res.text().catch(() => "");
      throw new ErroGerador(`Gemini respondeu ${res.status}`, res.status, corpo.slice(0, 500));
    }
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const bruto = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    let parsed: Partial<TextoGerado>;
    try {
      parsed = JSON.parse(bruto);
    } catch {
      throw new ErroGerador("Gemini devolveu um JSON inválido", 502, bruto.slice(0, 500));
    }
    if (!parsed.titulo || !parsed.texto) {
      throw new ErroGerador("Gemini devolveu uma resposta incompleta", 502, bruto.slice(0, 500));
    }
    const limpar = (s: string) => s.replace(/\s*—\s*/g, ", ").trim();
    return {
      titulo: limpar(parsed.titulo),
      resumo: limpar(parsed.resumo ?? ""),
      texto: limpar(parsed.texto),
      fonte: "gemini",
    };
  }
}

export class ErroGerador extends Error {
  constructor(
    message: string,
    public status: number,
    public detalhe?: string,
  ) {
    super(message);
  }
}

/** Tenta o gerador principal e cai pro template se ele falhar (cota estourada, rede, etc). */
export class GeradorComFallback implements Gerador {
  constructor(
    private principal: Gerador,
    private reserva: Gerador = new GeradorTemplate(),
    private onErro: (e: unknown) => void = (e) => console.error("[gerador]", e),
  ) {}

  async gerar(input: CaseInput, destaques: Destaque[]): Promise<TextoGerado> {
    try {
      return await this.principal.gerar(input, destaques);
    } catch (e) {
      this.onErro(e);
      return this.reserva.gerar(input, destaques);
    }
  }
}

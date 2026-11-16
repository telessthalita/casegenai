import type { Destaque } from "./metrics.js";
import type { CaseInput } from "./schema.js";
import type { TextoGerado } from "./generators.js";

export interface CaseStudy extends CaseInput, TextoGerado {
  id: string;
  destaques: Destaque[];
  created_at: string;
}

export interface Store {
  salvar(c: CaseStudy): Promise<void>;
  buscar(id: string): Promise<CaseStudy | undefined>;
}

/**
 * Guarda os cases na memória do processo. Simples e sem custo,
 * mas tudo some quando o servidor reinicia. Os mais antigos saem
 * quando passa do limite.
 */
export class MemoryStore implements Store {
  private cases = new Map<string, CaseStudy>();
  constructor(private limite = 500) {}

  async salvar(c: CaseStudy) {
    this.cases.set(c.id, c);
    while (this.cases.size > this.limite) {
      const maisAntigo = this.cases.keys().next().value;
      if (maisAntigo === undefined) break;
      this.cases.delete(maisAntigo);
    }
  }

  async buscar(id: string) {
    return this.cases.get(id);
  }
}

export function slugify(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "case";
}

export function novoId(nome: string): string {
  const sufixo = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  return `${slugify(nome)}-${sufixo}`;
}

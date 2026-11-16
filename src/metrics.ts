export interface Destaque {
  metrica: string;
  antes: number;
  depois: number;
  variacao_pct: number | null;
  multiplicador: number | null;
}

/**
 * Junta pares `x_antes` / `x_depois` e calcula o crescimento de cada um.
 * Métricas sem par ficam de fora dos destaques (mas seguem no prompt).
 */
export function calcularDestaques(metricas: Record<string, number>): Destaque[] {
  const destaques: Destaque[] = [];
  for (const [chave, antes] of Object.entries(metricas)) {
    if (!chave.endsWith("_antes")) continue;
    const base = chave.slice(0, -"_antes".length);
    const depois = metricas[`${base}_depois`];
    if (depois === undefined) continue;
    const variacao = antes === 0 ? null : ((depois - antes) / antes) * 100;
    destaques.push({
      metrica: base,
      antes,
      depois,
      variacao_pct: variacao === null ? null : Math.round(variacao * 10) / 10,
      multiplicador: antes === 0 ? null : Math.round((depois / antes) * 10) / 10,
    });
  }
  return destaques.sort((a, b) => (b.variacao_pct ?? 0) - (a.variacao_pct ?? 0));
}

export function nomeLegivel(metrica: string): string {
  return metrica.replace(/_/g, " ");
}

export function formatarNumero(n: number): string {
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

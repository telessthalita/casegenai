import { z } from "zod";

const nomeMetrica = /^[a-z][a-z0-9_]{0,39}$/;

export const caseInputSchema = z
  .object({
    startup_nome: z.string().trim().min(1, "informe o nome da startup").max(80),
    setor: z.string().trim().max(60).optional(),
    periodo: z.string().trim().max(60).optional(),
    contexto: z.string().trim().max(500).optional(),
    metricas: z
      .record(z.string(), z.number().finite().nonnegative())
      .refine((m) => Object.keys(m).length > 0, "envie pelo menos uma métrica")
      .refine((m) => Object.keys(m).length <= 16, "no máximo 16 métricas")
      .refine(
        (m) => Object.keys(m).every((k) => nomeMetrica.test(k)),
        "nomes de métrica em minúsculas, com letras, números e _ (ex: receita_antes)",
      ),
  })
  .strict();

export type CaseInput = z.infer<typeof caseInputSchema>;

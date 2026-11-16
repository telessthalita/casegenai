import type { MiddlewareHandler } from "hono";
import { getConnInfo } from "@hono/node-server/conninfo";

/** Limite simples por IP numa janela fixa. Guardado em memória. */
export function rateLimit(opts: { limite: number; janelaMs: number }): MiddlewareHandler {
  const contagem = new Map<string, { n: number; reinicia: number }>();

  return async (c, next) => {
    const agora = Date.now();
    const ip = descobrirIp(c);

    if (contagem.size > 10_000) {
      for (const [k, v] of contagem) if (v.reinicia <= agora) contagem.delete(k);
    }

    let registro = contagem.get(ip);
    if (!registro || registro.reinicia <= agora) {
      registro = { n: 0, reinicia: agora + opts.janelaMs };
      contagem.set(ip, registro);
    }
    registro.n++;

    const restante = Math.max(0, opts.limite - registro.n);
    c.header("X-RateLimit-Limit", String(opts.limite));
    c.header("X-RateLimit-Remaining", String(restante));

    if (registro.n > opts.limite) {
      c.header("Retry-After", String(Math.ceil((registro.reinicia - agora) / 1000)));
      return c.json(
        { status: "error", message: "Calma! Você atingiu o limite de cases por hora. Tenta de novo mais tarde." },
        429,
      );
    }
    await next();
  };
}

function descobrirIp(c: Parameters<MiddlewareHandler>[0]): string {
  // Atrás de proxy (Render, Railway etc) o IP real vem no X-Forwarded-For
  const encaminhado = c.req.header("x-forwarded-for")?.split(",")[0]?.trim();
  if (encaminhado) return encaminhado;
  try {
    return getConnInfo(c).remote.address ?? "desconhecido";
  } catch {
    return "desconhecido";
  }
}

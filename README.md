# CaseGenAI

Número solto não convence ninguém. O CaseGenAI é uma API que pega as métricas de uma startup (antes e depois) e devolve um case de sucesso bem escrito, pronto pra postar, mandar pra investidor ou colocar no site.

Junto com a API vem uma página simples pra testar no navegador: preenche o nome da startup, as métricas, clica em **Gerar case** e pronto.

## Como funciona

1. Você manda as métricas no formato `algo_antes` / `algo_depois` (ex: `usuarios_antes: 1000`, `usuarios_depois: 4500`).
2. A API calcula o crescimento de cada par (variação em % e quantas vezes cresceu).
3. Esses números vão pro **Gemini**, do Google, com instruções pra escrever um case curto, em português, sem inventar dado nenhum.
4. O case fica salvo e ganha um link próprio (`/case/{id}`) pra compartilhar.

Sem chave do Gemini a API não quebra: ela entra em **modo demo** e monta o texto a partir de um template. Se o Gemini falhar no meio do caminho (cota estourada, rede fora), ela também cai pro template e avisa no campo `fonte`.

## Stack

- Node.js 20.12+ e TypeScript
- [Hono](https://hono.dev) pro servidor HTTP
- [Zod](https://zod.dev) pra validar o que chega
- Gemini (API REST, plano gratuito) pra gerar o texto
- Vitest pros testes

## Rodando localmente

```bash
git clone https://github.com/telessthalita/casegenai.git
cd casegenai
npm install
npm run dev
```

Abre http://localhost:8080 e clica em **Preencher com exemplo** pra ver funcionando.

### Ligando a IA

1. Pega uma chave grátis em https://aistudio.google.com/apikey (não pede cartão).
2. Copia o arquivo de exemplo e cola a chave nele:

```bash
cp .env.example .env
```

```
GEMINI_API_KEY=sua_chave_aqui
```

3. Reinicia o `npm run dev`. No terminal aparece `modo gemini`.

### Variáveis de ambiente

| Variável | Pra que serve | Padrão |
| --- | --- | --- |
| `GEMINI_API_KEY` | Chave do Gemini. Sem ela, roda em modo demo | vazio |
| `GEMINI_MODEL` | Qual modelo do Gemini usar | `gemini-2.5-flash` |
| `PORT` | Porta do servidor | `8080` |
| `RATE_LIMIT` | Quantos cases cada IP pode gerar por hora | `20` |

### Scripts

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Sobe o servidor e reinicia quando você salva um arquivo |
| `npm start` | Sobe o servidor (é o que roda em produção) |
| `npm test` | Roda os testes |
| `npm run typecheck` | Confere os tipos do TypeScript |

## Endpoints

### `GET /api`

Diz se a API está de pé e em qual modo.

```json
{ "status": "success", "message": "CaseGenAI API está funcionando!", "modo": "gemini" }
```

### `POST /api/case`

Gera um case novo.

```bash
curl -X POST http://localhost:8080/api/case \
  -H "content-type: application/json" \
  -d '{
    "startup_nome": "FitTrack",
    "setor": "saúde e bem-estar",
    "periodo": "12 meses",
    "contexto": "Lançamos o plano anual e um programa de indicação",
    "metricas": {
      "usuarios_antes": 1000,
      "usuarios_depois": 4500,
      "receita_antes": 5000,
      "receita_depois": 22000
    }
  }'
```

| Campo | Obrigatório | Regra |
| --- | --- | --- |
| `startup_nome` | sim | até 80 caracteres |
| `metricas` | sim | de 1 a 16 números (zero ou mais). Nomes em minúsculas, com letras, números e `_` |
| `setor` | não | até 60 caracteres |
| `periodo` | não | até 60 caracteres |
| `contexto` | não | até 500 caracteres. O que a startup fez de diferente |

Resposta (`201`):

```json
{
  "status": "success",
  "message": "Case gerado com sucesso",
  "data": {
    "id": "fittrack-3f9a1c2e",
    "url": "/case/fittrack-3f9a1c2e",
    "titulo": "FitTrack: 4,5x mais usuários em um ano",
    "resumo": "...",
    "texto": "Parágrafo 1...\n\nParágrafo 2...",
    "fonte": "gemini",
    "destaques": [
      { "metrica": "usuarios", "antes": 1000, "depois": 4500, "variacao_pct": 350, "multiplicador": 4.5 },
      { "metrica": "receita", "antes": 5000, "depois": 22000, "variacao_pct": 340, "multiplicador": 4.4 }
    ],
    "startup_nome": "FitTrack",
    "metricas": { "...": "..." },
    "created_at": "2026-11-16T13:30:00.000Z"
  }
}
```

Erros possíveis: `400` (JSON quebrado), `422` (dados inválidos, com a lista em `erros`), `413` (corpo maior que 16 KB) e `429` (passou do limite por hora).

### `GET /api/case/{id}`

Devolve um case já gerado. `404` se não existir.

### `GET /case/{id}`

A mesma coisa, só que numa página bonitinha pra compartilhar.

## Segurança

- Validação de tudo que entra com Zod (campos extras são recusados)
- Chave do Gemini só em variável de ambiente, nunca no código
- Rate limit por IP
- Headers de segurança (Content-Security-Policy, X-Frame-Options e companhia)
- Conteúdo escapado na página do case, nada de HTML injetado

## Limitações (por enquanto)

- Os cases ficam guardados **na memória** do servidor. Reiniciou, sumiram. Pra uma demo isso basta; o próximo passo seria plugar um banco (Supabase ou MongoDB Atlas, os dois têm plano grátis).
- O rate limit também fica em memória, então vale por instância.

## Publicando

O repo já tem um `render.yaml` pronto pro plano grátis do [Render](https://render.com):

1. No Render, **New > Blueprint** e escolhe este repositório.
2. Quando pedir, cola a `GEMINI_API_KEY`.
3. Pronto: a URL pública aparece no painel.

No plano grátis o servidor dorme depois de uns 15 minutos parado, então o primeiro acesso depois disso demora uns segundos.

## Testes

```bash
npm test
```

Cobrem o cálculo das métricas, validação, rate limit, as páginas e a integração com o Gemini (com a resposta simulada, sem gastar cota).

## Licença

MIT

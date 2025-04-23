# CaseGenAI

API para geração automática de cases de estudo para startups utilizando IA.

## Descrição

O CaseGenAI é uma API desenvolvida em PHP com Slim Framework e MongoDB que permite gerar automaticamente cases de estudo para startups com base em métricas de crescimento. A API utiliza a tecnologia Gemini AI da Google para criar textos persuasivos e profissionais que destacam o crescimento e sucesso das startups.

## Requisitos

- PHP 8.2+
- MongoDB
- Composer

## Instalação

1. Clone o repositório:
```bash
git clone https://github.com/seu-usuario/casegenai.git
cd casegenai
```

2. Instale as dependências:
```bash
composer install
```

3. Configure as variáveis de ambiente:
```bash
cp .env.example .env
```

4. Edite o arquivo `.env` com suas configurações:
```
MONGODB_URI=mongodb://localhost:27017
MONGODB_DATABASE=casegenai
GEMINI_API_KEY=sua_chave_api_gemini
JWT_SECRET=chave_secreta_para_jwt
RATE_LIMIT=100
```

5. Inicie o servidor:
```bash
php -S 0.0.0.0:8080 -t public
```

## Estrutura do Projeto

```
CaseGenAI/
├── public/
│   └── index.php
├── src/
│   ├── Controllers/
│   │   └── CaseController.php
│   ├── Models/
│   │   ├── Database.php
│   │   └── CaseStudy.php
│   ├── Services/
│   │   └── GeminiService.php
│   ├── Middleware/
│   │   ├── LogMiddleware.php
│   │   ├── RateLimitMiddleware.php
│   │   └── SecurityMiddleware.php
│   └── Config/
│       └── routes.php
├── vendor/
├── logs/
├── .env
├── .env.example
└── composer.json
```

## Endpoints da API

### Verificar Status da API

```
GET /
```

Resposta:
```json
{
    "status": "success",
    "message": "CaseGenAI API está funcionando!"
}
```

### Criar um Case Study

```
POST /api/case
```

Corpo da requisição:
```json
{
    "startup_nome": "FitTrack",
    "metricas": {
        "usuarios_antes": 1000,
        "usuarios_depois": 4500,
        "receita_antes": 5000,
        "receita_depois": 22000
    }
}
```

Resposta:
```json
{
    "status": "success",
    "message": "Case study gerado com sucesso",
    "data": {
        "id": "65a4f3c2e8d7b9a1c2d3e4f5",
        "url": "/case/fittrack",
        "texto_preview": "FitTrack: Transformando Saúde em Crescimento Exponencial..."
    }
}
```

### Consultar um Case Study

```
GET /api/case/{id}
```

Resposta:
```json
{
    "status": "success",
    "data": {
        "_id": "65a4f3c2e8d7b9a1c2d3e4f5",
        "startup_nome": "FitTrack",
        "metricas": {
            "usuarios_antes": 1000,
            "usuarios_depois": 4500,
            "receita_antes": 5000,
            "receita_depois": 22000
        },
        "texto_ia": "FitTrack: Transformando Saúde em Crescimento Exponencial...",
        "url_slug": "fittrack",
        "created_at": "2025-04-23 17:30:00",
        "updated_at": "2025-04-23 17:30:00"
    }
}
```

## Recursos de Segurança

- Validação de inputs contra XSS/SQL Injection
- Armazenamento seguro da chave da API Gemini em variável de ambiente
- Rate limiting (100 requisições/hora por IP)
- Headers de segurança (Content-Security-Policy, X-XSS-Protection, etc.)
- Logs de acesso aos cases

## Integração com Gemini AI

A API utiliza o Gemini AI da Google para gerar textos de case studies com base nas métricas fornecidas. O serviço formata um prompt adequado com os dados da startup e processa a resposta da API para criar um case study completo e persuasivo.

## Licença

Este projeto está licenciado sob a licença MIT.

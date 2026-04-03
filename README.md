# Autonomous Edge Security Agent (AESA)

An autonomous security investigation pipeline on the Cloudflare developer platform. AESA combines **Workers AI (Llama 3.3)**, **Cloudflare Workflows**, **Durable Objects**, **D1**, **Vectorize**, **KV**, and a **React** dashboard with **WebSockets** for live updates.

**Hosted at:** [https://soc-agent.csramineni.workers.dev/](https://soc-agent.csramineni.workers.dev/)

![SOC Dashboard Status](https://img.shields.io/badge/Status-Operational-brightgreen?style=for-the-badge&logo=cloudflare)
![Tech Stack](https://img.shields.io/badge/Stack-React_|_Workers_|_Llama_3.3-blue?style=for-the-badge)

## Architecture

### Backend (`soc-agent/`)

| Layer | Role |
| --- | --- |
| **Durable Object** (`InvestigationTicket`) | WebSocket sessions, ticket id from the upgrade URL, broadcast to clients. Starts a **Workflow** when a symptom is received. |
| **Workflow** (`InvestigationWorkflow`) | Durable multi-step run: RAG → LLM tool loop → **D1** log queries → WAF rule → **KV** enforcement keys. Survives timeouts better than a long `for` loop in a DO. |
| **Workers AI** | `@cf/meta/llama-3.3-70b-instruct-fp8-fast` for JSON tool decisions; `@cf/baai/bge-small-en-v1.5` for embeddings (Vectorize + symptom). |
| **D1** | `http_logs` table: synthetic edge request rows. `check_logs` runs real SQL (timeframe, keyword, optional ASN). |
| **Vectorize** | SOP snippets embedded and queried for retrieval-augmented prompts. |
| **KV** (`ACTIVE_BLOCKS`) | On finalize, stores `asn:<id>` / `ip:<addr>` for optional enforcement. |
| **HTTP** | Status page, `/health`, `/?test=ai` diagnostics. |

### Enforcement worker (`enforcement-worker/`)

A small separate Worker that reads the same **KV** namespace and returns **403** when the request’s `cf-connecting-ip` or ASN matches a stored block. Deploy it on its own route or `*.workers.dev` to demo end-to-end blocking.

### Frontend (`frontend/`)

React + Tailwind + **Catppuccin Mocha**: terminal-style UI, live WebSocket stream, WAF rule display.

## Prerequisites

- Node.js 18+
- [Wrangler](https://developers.cloudflare.com/workers/wrangler/install-upgrading/) (`wrangler login`)
- Cloudflare: Workers AI, Durable Objects, D1, KV, Vectorize, and Workflows available on your account

## Local development

1. **Clone and install (monorepo)**

   ```bash
   git clone <repository-url>
   cd cf_ai_soc_agent
   npm install
   ```

2. **Backend**

   ```bash
   cd soc-agent
   npx wrangler dev
   ```

   Default: `http://localhost:8787`. Create D1/KV/Vectorize resources and bind IDs in `wrangler.jsonc` if you have not already (`wrangler d1 create`, `wrangler kv namespace create`, `wrangler vectorize create`, etc.).

3. **Seed local D1 (optional)**

   After applying migrations:

   ```bash
   cd soc-agent
   npx wrangler d1 migrations apply soc-logs --local
   node scripts/generate-d1-seed.mjs
   npx wrangler d1 execute soc-logs --local --file=./seed.sql
   ```

   `seed.sql` is generated and listed in `.gitignore`. For **remote** D1: `npm run seed:d1` (applies the generated seed to the remote database).

4. **Frontend**

   ```bash
   cd ../frontend
   echo "VITE_BACKEND_WS_URL=ws://localhost:8787" > .env
   npm run dev
   ```

   Open `http://localhost:5173`.

## Deployment

### Main Worker + workflow

```bash
cd soc-agent
npx wrangler deploy
```

### Frontend (Pages)

```bash
cd frontend
npm run build
npx wrangler pages deploy dist --project-name soc-agent-dashboard
```

Set `VITE_BACKEND_WS_URL` to your production Worker WebSocket URL (e.g. `wss://soc-agent.<user>.workers.dev`) when building for production.

### Enforcement Worker

```bash
cd enforcement-worker
npm install
npx wrangler deploy
```

Use the same KV namespace IDs as in `soc-agent/wrangler.jsonc` so blocks written by the SOC agent are visible here.

## Investigation flow (high level)

1. User submits a symptom over WebSocket.
2. DO stores the ticket id and starts **InvestigationWorkflow**.
3. Workflow retrieves **Vectorize** SOP context, then loops: **LLM** → optional **D1** `check_logs` with real rows → **WAF rule** from evidence + parameters → **KV** keys for enforcement.
4. The DO streams each step back to the UI.

## License

MIT. Built for the Cloudflare AI SOC Agent Internship.

## Project: Autonomous Edge Security Agent (`cf_ai_soc_agent`)

This app runs an **agentic investigation loop** on the Cloudflare edge. A **Durable Object** keeps per-ticket state and streams each step (over **WebSockets**) to a terminal-style SOC dashboard.

In the demo environment, the backend simulates log evidence (including an SQLi spike with the `UNION SELECT` payload from ASN `13335`) and finally generates a **Cloudflare WAF rule object** in strict JSON.

## Architecture

1. **Frontend** (`/frontend`)
   - Vite + React dashboard
   - WebSocket client renders `step` events sequentially
   - Final WAF rule rendered as JSON in a highlighted block

2. **Backend** (`/backend`)
   - Worker + Durable Object `InvestigationTicket`
   - WebSocket endpoint:
     - `Upgrade: websocket` requests are routed to a ticket by `?ticketId=<uuid>`
     - client sends the initial message: `{ "symptom": "<string>" }`
   - Durable Object:
     - persists investigation history in `this.ctx.storage`
     - streams status updates via `broadcast(data: object)`
     - runs the ReAct-like loop using **Workers AI** in JSON mode

## Prerequisites

- Node.js 18+
- Wrangler installed (`npm i -g wrangler`)
- `wrangler login`
- Cloudflare account with Workers AI and Durable Objects enabled

## Local development

Open two terminals.

### Backend (Workers + Durable Object)
```bash
cd backend
npm install
wrangler dev
```

`wrangler dev` serves the Worker on `http://localhost:8787` by default (WebSocket: `ws://localhost:8787`).

### Frontend (Vite)
```bash
cd frontend
npm install
npm run dev
```

### Connect frontend -> backend (WebSocket URL)

Because the frontend dev server runs on a different origin than the Worker, configure:

Create `frontend/.env`:
```bash
VITE_BACKEND_WS_URL=ws://localhost:8787
```

The frontend will connect to:
`ws(s)://<backend>/?ticketId=<uuid>`

## Production deployment

### 1) Deploy the backend Worker
```bash
cd backend
npm install
wrangler deploy
```

### 2) Deploy the frontend to Cloudflare Pages
```bash
cd frontend
npm install
npm run build

# Example: deploy the generated Vite output
# (adjust project/branch names to your Pages setup)
wrangler pages deploy dist --project-name <YOUR_PAGES_PROJECT> --branch main
```

### 3) Configure the Pages build to point at your deployed Worker

You provided:
`https://soc-agent.csramineni.workers.dev/`

Set `VITE_BACKEND_WS_URL` during the frontend build (no trailing slash):
```bash
VITE_BACKEND_WS_URL=wss://soc-agent.csramineni.workers.dev
```

## Agent behavior (demo)

The agentic loop alternates between:

- `check_logs`: backend injects mock evidence (SQLi attempts containing `UNION SELECT` from ASN `13335`)
- `generate_waf_rule`: backend returns a JSON object representing a Cloudflare WAF rule that blocks that evidence pattern
- `ask_user`: would request missing info (in this demo path it should usually converge automatically)

Each loop step is streamed live to the dashboard.

## Repository layout

- `frontend/` - Vite + React + catppuccin terminal dashboard
- `backend/` - Workers + Durable Object + Workers AI + WebSockets

## Project: Autonomous Edge Security Agent (`cf_ai_soc_agent`)

This app runs an **agentic investigation loop** on the Cloudflare edge. A **Durable Object** keeps per-ticket state and streams each step (over **WebSockets**) to a terminal-style SOC dashboard.

In the demo environment, the backend simulates log evidence (including an SQLi spike with the `UNION SELECT` payload from ASN `13335`) and finally generates a **Cloudflare WAF rule object** in strict JSON.

## Architecture

1. **Frontend** (`/frontend`)
   - Vite + React dashboard
   - WebSocket client renders `step` events sequentially
   - Final WAF rule rendered as JSON in a highlighted block

2. **Backend** (`/backend`)
   - Worker + Durable Object `InvestigationTicket`
   - WebSocket endpoint:
     - `Upgrade: websocket` requests are routed to a ticket by `?ticketId=<uuid>`
     - client sends the initial message: `{ "symptom": "<string>" }`
   - Durable Object:
     - persists investigation history in `this.ctx.storage`
     - streams status updates via `broadcast(data: object)`
     - runs the ReAct-like loop using **Workers AI** in JSON mode

## Prerequisites

- Node.js 18+
- Wrangler installed (`npm i -g wrangler`)
- `wrangler login`
- Cloudflare account with Workers AI and Durable Objects enabled

## Local development

Open two terminals.

### Backend (Workers + Durable Object)
```bash
cd backend
npm install
wrangler dev
```

`wrangler dev` serves the Worker on `http://localhost:8787` by default (WebSocket: `ws://localhost:8787`).

### Frontend (Vite)
```bash
cd frontend
npm install
npm run dev
```

### Connect frontend -> backend (WebSocket URL)

Because the frontend dev server runs on a different origin than the Worker, configure:

Create `frontend/.env`:
```bash
VITE_BACKEND_WS_URL=ws://localhost:8787
```

The frontend will connect to:
`ws(s)://<backend>/ ?ticketId=<uuid>`

## Production deployment

### 1) Deploy the backend Worker
```bash
cd backend
npm install
wrangler deploy
```

### 2) Deploy the frontend to Cloudflare Pages
```bash
cd frontend
npm install
npm run build

# Example: deploy the generated Vite output
# (adjust project/branch names to your Pages setup)
wrangler pages deploy dist --project-name <YOUR_PAGES_PROJECT> --branch main
```

### 3) Configure the Pages build to point at your deployed Worker

You provided:
`https://soc-agent.csramineni.workers.dev/`

Set `VITE_BACKEND_WS_URL` during the frontend build (no trailing slash):
```bash
VITE_BACKEND_WS_URL=wss://soc-agent.csramineni.workers.dev
```

## Agent behavior (demo)

The agentic loop alternates between:

- `check_logs`: backend injects mock evidence (SQLi attempts containing `UNION SELECT` from ASN `13335`)
- `generate_waf_rule`: backend returns a JSON object representing a Cloudflare WAF rule that blocks that evidence pattern
- `ask_user`: would request missing info (in this demo path it should usually converge automatically)

Each loop step is streamed live to the dashboard.

## Repository layout

- `frontend/` - Vite + React + catppuccin terminal dashboard
- `backend/` - Workers + Durable Object + Workers AI + WebSockets

 

 

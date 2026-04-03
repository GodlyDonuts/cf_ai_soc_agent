# Autonomous Edge Security Agent (AESA)

An intelligent, autonomous security orchestration and response (SOAR) agent running entirely on the Cloudflare Edge. AESA leverages **Cloudflare Workers AI**, **Durable Objects**, and **WebSockets** to investigate threats and deploy mitigations in real-time.

![SOC Dashboard Status](https://img.shields.io/badge/Status-Operational-brightgreen?style=for-the-badge&logo=cloudflare)
![Tech Stack](https://img.shields.io/badge/Stack-React_|_Workers_|_Llama_3.3-blue?style=for-the-badge)

## 🏗️ Architecture

### 1. The Autonomous Backend (`/soc-agent`)
A dual-purpose Cloudflare Worker that serves as the "brain" of the operation.
- **Agentic Loop**: Implements a ReAct (Reasoning + Acting) loop using **Llama 3.3** to autonomously analyze security symptoms.
- **Stateful Forensics**: Uses **Durable Objects** (`InvestigationTicket`) to maintain the context of a security incident across multiple AI reasoning steps.
- **Dual-Purpose Interface**:
  - **WebSocket (WSS)**: Streams real-time "thinking" and "action" steps to the forensic dashboard.
  - **HTTP (HTTPS)**: Provides a professional System Status page and AI diagnostic tools.

### 2. The Forensic Dashboard (`/frontend`)
A high-fidelity, terminal-style interface built with **React**, **Tailwind CSS**, and the **Catppuccin Mocha** design system.
- **Real-time Streaming**: Renders the agent's internal monologue and forensic findings as they happen.
- **Threat Intelligence Badges**: Automatically extracts and displays `Severity`, `Threat Type`, and `ASN` metadata from AI findings.
- **WAF Deployment UI**: Visualizes the generation and deployment of Cloudflare WAF rules with smooth pulse animations.

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-upgrading/) installed and authenticated (`wrangler login`).
- A Cloudflare account with Workers AI and Durable Objects enabled.

### Local Development

1. **Clone and Install**
   ```bash
   git clone <repository-url>
   cd cf_ai_soc_agent
   ```

2. **Start the Backend**
   ```bash
   cd soc-agent
   npm install
   npx wrangler dev
   ```
   *The backend will run on `http://localhost:8787`.*

3. **Start the Frontend**
   ```bash
   cd ../frontend
   npm install
   # Create a .env file
   echo "VITE_BACKEND_WS_URL=ws://localhost:8787" > .env
   npm run dev
   ```
   *The dashboard will be available at `http://localhost:5173`.*

## 🌍 Deployment

### 1. Backend (Workers)
```bash
cd soc-agent
npx wrangler deploy
```

### 2. Frontend (Pages)
```bash
cd frontend
npm run build
npx wrangler pages deploy dist --project-name soc-agent-dashboard
```
> [!TIP]
> Ensure the `VITE_BACKEND_WS_URL` is set to your production Worker URL (e.g., `wss://soc-agent.<user>.workers.dev`) during the build process.

## 🧠 Sophisticated Intelligence
AESA is governed by a **Senior SOC Engineer Persona** that follows a strict Standard Operating Procedure (SOP):
1. **Triage**: Extracting key indicators (IPs, ASNs, User-Agents) from reports.
2. **Analysis**: Correlating symptoms with edge logs (SQLi, DDoS, Credential Stuffing).
3. **Mitigation**: Generating precise, JSON-formatted Cloudflare WAF rules to block identified threats.
4. **Verification**: Confirming the effectiveness of the proposed rule before finalizing.

## 📄 License
MIT. Built for the Cloudflare AI SOC Agent Internship.

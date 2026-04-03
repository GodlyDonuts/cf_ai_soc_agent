Project: cf_ai_soc_agent (Autonomous Edge Security Agent)
Context & Goal
You are an expert full-stack developer specializing in the Cloudflare developer ecosystem (Workers, Pages, Workers AI, Durable Objects, and WebSockets).
I am applying for a Software Engineering Internship at Cloudflare. I need to build a highly impressive AI-powered application that goes beyond a simple chatbot.

We are building an "Autonomous Edge Security Agent". When a user reports a website issue (e.g., "We are getting a lot of weird traffic from unknown IPs"), the application will use an Agentic loop (ReAct) to investigate the issue, simulate checking logs, and automatically generate a Cloudflare WAF rule to mitigate the threat.

Required Architecture & Tech Stack
Frontend (Dashboard): Cloudflare Pages hosting a Vite + React + Tailwind CSS dashboard. It should look like a dark-themed terminal or security command center, showing real-time updates as the AI "thinks" and "acts."

Backend (Agent Orchestration): Cloudflare Workers.

AI (LLM with Tool Calling): Cloudflare Workers AI using the @cf/meta/llama-3.3-70b-instruct-fp8-fast model. We will force the model to output strict JSON to simulate tool calling.

State/Memory & Real-time: Cloudflare Durable Objects + WebSockets. The Durable Object manages the state of the "Investigation Ticket" and uses WebSockets to stream the AI's step-by-step investigation process back to the frontend in real-time.

Project Constraints & File Structure
The repository MUST be prefixed with cf_ai_ (e.g., cf_ai_soc_agent).

The project must use a monorepo structure:

/frontend (Vite/React/Pages app)

/backend (Worker/Durable Object)

Generate a README.md with clear instructions on how to run this locally (wrangler dev) and deploy it.

Generate a PROMPTS.md file tracking our prompts.

Step-by-Step Implementation Plan
Please acknowledge this plan and ask my permission to begin Step 1. We will go step-by-step. Do not generate code for future steps until instructed.

Step 1: Project Setup & Scaffolding
Initialize the /frontend (Vite + React) and /backend directories.

Create the wrangler.jsonc in the /backend with bindings for Workers AI (AI) and a Durable Object class (InvestigationTicket).

Provide the exact terminal commands needed to scaffold this setup.

Step 2: Implement the Durable Object with WebSockets
In /backend/src/index.ts, implement the standard Worker fetch handler that routes WebSocket upgrade requests to the InvestigationTicket Durable Object.

Implement the Durable Object class. It must:

Handle the Upgrade header and accept the WebSocket connection.

Listen for an initial JSON message containing the user's reported symptom.

Store the connection and investigation history in this.ctx.storage.

Expose a helper function broadcast(data: object) to stream status updates back to the client (e.g., {"step": "thinking", "message": "Analyzing report..."}).

Step 3: Implement the Agentic Loop with Workers AI
Inside the Durable Object, write an async runInvestigation(symptom) function.

Create a strict System Prompt instructing Llama 3.3 to ONLY output JSON in this format: {"action": "check_logs" | "generate_waf_rule" | "ask_user", "reasoning": "...", "parameters": {...}}.

Implement a simulated environment loop:

If the LLM outputs check_logs, the backend injects mock log data (specifically: simulate a spike in SQL injection attempts containing UNION SELECT from ASN 13335).

Feed the mock logs back to the LLM.

Loop until the LLM outputs generate_waf_rule, returning a JSON representation of a Cloudflare WAF rule targeting the specific ASN or payload.

Step 4: Implement the Frontend (The SOC Dashboard)
Build the React frontend in /frontend.

Create a dark-themed UI (using Tailwind) with an input bar for reporting issues.

Implement a WebSocket client that connects to the backend Worker.

Create a "Terminal" component that displays the WebSocket stream of the AI's actions sequentially. Make it Ascetically pleasing to look at, macOS terminal with a catpucchino theme.

When the final WAF rule is received, display it in a highlighted code block.

Step 5: Documentation
Generate a comprehensive README.md explaining the Agentic architecture, the ReAct loop, how it leverages Edge compute for security, and how to run it locally.
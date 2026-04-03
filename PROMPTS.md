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


Proceed with phase 1.

Proceed to phase 2

Proceed to phase 3

Proceed to phase 4 & 5

---

Upgrade the backend "Large Prompt" to define a senior SOC Engineer persona with structured SOPs for triage, analysis, and mitigation.

Schema Expansion:

Add severity (high/medium/low) and threat_type (SQLi, DDoS, etc.) to the AI output.
Ensure these metadata parameters are broadcasted to the frontend in real-time.
Implement a 3-attempt retry loop with exponential backoff for Workers AI calls to handle platform transient errors.

Create an aesthetically pleasing macOS terminal with a Catppuccin Mocha theme.

Component Requirements:

Render threat intelligence metadata (Severity, Threat Type, ASN) as Pill-shaped Badges with Mocha-palette backgrounds.
Add a Pulse Animation to the current status indicator to show the agent is "thinking."
Implement a WAF Deployment View that visualizes the rule generation with a dedicated "DEPLOYED TO EDGE" badge and pulse effects.

Implement a Dual-Purpose Worker:

Support WebSocket upgrades for the Dashboard.
Support standard HTTP requests for AI diagnostics (returning JSON test results).
Add a Visual Status Page (HTML) to the Worker root to confirm system health and provide direct links.
Implement a robust regex-based WebSocket handshake matcher to handle header variations at the Cloudflare edge.


Act as an expert Cloudflare developer. I need to refactor my Cloudflare AI SOC Agent application to move it from a simulated chatbot to a real, autonomous defense system using Cloudflare's latest primitives.

Please rewrite the provided codebase (Durable Object, Worker, and frontend) to implement the following architectural upgrades:

Model Upgrade: Change the Workers AI model binding from Llama 3 8B to @cf/meta/llama-3.3-70b-instruct-fp8-fast for better tool-calling capabilities.

Real Tool Calling with D1: Replace the hardcoded check_logs mock data. Add a Cloudflare D1 database binding, provide a schema for dummy HTTP logs, and update the code so the LLM dynamically queries this D1 database using parameters it generates.

Cloudflare Workflows: Remove the rigid for loop in the Durable Object. Migrate the multi-step investigation logic (Triage -> Query Logs -> Generate Rule) into a Cloudflare Workflow. Keep the Durable Object strictly for handling the WebSocket connection and streaming state updates to the UI.

Active Enforcement via KV: Add a Cloudflare KV namespace (ACTIVE_BLOCKS). When the AI generates a final WAF rule, write the blocked IP/ASN to this KV. Provide a small reverse-proxy Worker snippet that checks this KV and returns a 403 Forbidden for blocked traffic.

RAG with Vectorize (Memory): Add a Cloudflare Vectorize binding. When a user reports a symptom, perform a similarity search against a mock index of Security SOPs (Standard Operating Procedures) and inject the relevant SOP into the LLM's system prompt before generating the first action.
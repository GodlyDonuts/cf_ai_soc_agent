import { EMBEDDING_MODEL, LLM_MODEL } from './model';
import { InvestigationTicket } from './durable-object';
import { InvestigationWorkflow } from './workflow';
import type { SocEnv } from './types';

export { InvestigationTicket, InvestigationWorkflow };

export default {
  async fetch(request: Request, env: SocEnv, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    const upgradeHeader = request.headers.get('Upgrade') || '';
    const isWebSocket = /websocket/i.test(upgradeHeader);

    if (isWebSocket) {
      const ticketId = url.searchParams.get('ticketId') ?? 'default';
      try {
        const id = env.INVESTIGATION_TICKET.idFromName(ticketId);
        return env.INVESTIGATION_TICKET.get(id).fetch(request);
      } catch (err) {
        console.error('Durable Object fetch error:', err);
        return new Response('Durable Object Fetch Error', { status: 500 });
      }
    }

    if (url.pathname === '/health') {
      try {
        const result = await env.AI.run(EMBEDDING_MODEL as any, {
          text: ['Hello'],
        });
        return new Response(JSON.stringify({ status: 'ok', result }), {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (err) {
        return new Response(
          JSON.stringify({
            status: 'error',
            message: err instanceof Error ? err.message : String(err),
          }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }
    }

    if (url.searchParams.get('test') === 'ai') {
      const tasks = [];
      try {
        const simple = { prompt: 'Tell me a joke about Cloudflare' };
        const response1 = await env.AI.run(LLM_MODEL as any, simple);
        tasks.push({ inputs: simple, response: response1 });

        const chat = {
          messages: [
            { role: 'system', content: 'You are a helpful assistant.' },
            { role: 'user', content: 'Who won the world series in 2020?' },
          ],
        };
        const response2 = await env.AI.run(LLM_MODEL as any, chat);
        tasks.push({ inputs: chat, response: response2 });

        return Response.json(tasks);
      } catch (err) {
        return new Response(
          JSON.stringify({
            error: 'AI test failure',
            message: err instanceof Error ? err.message : String(err),
          }),
          { status: 500, headers: { 'Content-Type': 'application/json' } },
        );
      }
    }

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>SOC Agent System Status</title>
          <style>
              body { background: #11111b; color: #cdd6f4; font-family: system-ui, -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
              .card { border: 1px solid #313244; background: #181825; padding: 2.5rem; border-radius: 16px; max-width: 480px; width: 90%; box-shadow: 0 20px 50px rgba(0,0,0,0.6); text-align: center; }
              .status { display: flex; align-items: center; justify-content: center; gap: 12px; margin-bottom: 1.5rem; }
              .dot { width: 12px; height: 12px; background: #a6e3a1; border-radius: 50%; box-shadow: 0 0 15px #a6e3a1; animation: pulse 2s infinite; }
              @keyframes pulse { 0% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.2); opacity: 0.5; } 100% { transform: scale(1); opacity: 1; } }
              h1 { margin: 0; font-size: 1.6rem; color: #f5c2e7; font-weight: 700; }
              p { font-size: 0.95rem; line-height: 1.6; opacity: 0.8; margin-bottom: 2rem; color: #bac2de; }
              .links { display: flex; flex-direction: column; gap: 12px; }
              .btn { text-decoration: none; padding: 14px; border-radius: 8px; background: #313244; color: #89b4fa; font-size: 0.9rem; font-weight: 600; transition: all 0.2s; border: 1px solid transparent; }
              .btn:hover { background: #45475a; border-color: #585b70; transform: translateY(-1px); }
              .btn.primary { background: #89b4fa; color: #11111b; }
              .btn.primary:hover { background: #b4befe; }
              .footer { margin-top: 2rem; font-size: 0.75rem; opacity: 0.5; font-family: monospace; }
          </style>
      </head>
      <body>
          <div class="card">
              <div class="status">
                  <div class="dot"></div>
                  <h1>SOC Agent Online</h1>
              </div>
              <p>The Autonomous Edge Security Analyst coordinates Durable Objects, Workflows, D1, Vectorize, and KV for live investigations.</p>
              <div class="links">
                  <a href="https://soc-agent-dashboard.pages.dev" class="btn primary">Open Security Dashboard</a>
                  <a href="/?test=ai" class="btn">Run Platform AI Diagnostics</a>
              </div>
              <div class="footer">v2.0.0 | cloudflare-edge-ai</div>
          </div>
      </body>
      </html>
    `;
    return new Response(html, { headers: { 'Content-Type': 'text/html' } });
  },
};

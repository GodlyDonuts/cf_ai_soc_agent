// Phase 2 / Step 2:
// - Worker fetch handler forwards WebSocket upgrades to the InvestigationTicket Durable Object
// - Durable Object accepts the socket, persists connection + history in `this.ctx.storage`,
//   and streams status updates back to the client via `broadcast()`.

import { DurableObject } from 'cloudflare:workers'

export interface Env {
  AI: Ai;
  INVESTIGATION_TICKET: DurableObjectNamespace<InvestigationTicket>;
}

type InvestigationHistoryEntry = {
  ts: number;
  step: string;
  message: string;
  meta?: Record<string, unknown>;
};

type LlmAction = 'check_logs' | 'generate_waf_rule' | 'ask_user';

type LlmToolOutput = {
  action: LlmAction;
  reasoning: string;
  parameters: {
    asn?: number;
    payload?: string;
    severity?: 'high' | 'medium' | 'low';
    threat_type?: string;
    question?: string;
    [k: string]: unknown;
  };
};

function tryParseJsonMessage(message: string | ArrayBuffer): unknown | null {
  try {
    if (typeof message === 'string') return JSON.parse(message);
    return JSON.parse(new TextDecoder().decode(message));
  } catch {
    return null;
  }
}

export class InvestigationTicket extends DurableObject<Env> {
  private getConnectionIdFromWs(ws: WebSocket): string | null {
    for (const tag of this.ctx.getTags(ws)) {
      if (tag.startsWith('connection:')) return tag.slice('connection:'.length);
    }
    return null;
  }

  private async appendHistory(entry: InvestigationHistoryEntry): Promise<void> {
    const history = ((await this.ctx.storage.get('history')) ??
      []) as InvestigationHistoryEntry[];
    history.push(entry);
    await this.ctx.storage.put('history', history);
  }

  // Broadcasts status updates to *all* active websocket clients for this ticket.
  async broadcast(data: object): Promise<void> {
    const payload = JSON.stringify(data);
    for (const ws of this.ctx.getWebSockets('client')) {
      // Best-effort: if a socket is hibernated/closed this can throw.
      try {
        ws.send(payload);
      } catch {
        // Ignore send errors; message delivery will be retried on the next step.
      }
    }
  }

  private buildMockSqlInjectionLogs(): string {
    const asn = 13335;
    const payload = 'UNION SELECT';
    const exampleRows = [
      {
        ts: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
        srcAsn: asn,
        srcIp: '203.0.113.10',
        type: 'sql_injection',
        signature: payload,
        request: 'GET /search?q=1 UNION SELECT password FROM users',
      },
      {
        ts: new Date(Date.now() - 55 * 1000).toISOString(),
        srcAsn: asn,
        srcIp: '203.0.113.44',
        type: 'sql_injection',
        signature: payload,
        request: 'POST /login {"username":"admin","pass":"x"} UNION SELECT ...',
      },
      {
        ts: new Date(Date.now() - 12 * 1000).toISOString(),
        srcAsn: asn,
        srcIp: '203.0.113.88',
        type: 'sql_injection',
        signature: payload,
        request: 'GET /api?q=1 UNION SELECT credit_card FROM billing',
      },
    ];

    const summary = {
      anomaly: 'spike_in_sql_injection_attempts',
      windowMinutes: 10,
      topAsn: asn,
      evidence: {
        payloadMustContain: payload,
        note: 'Mock data injected by backend (simulated environment).',
      },
    };

    return `${JSON.stringify(summary, null, 2)}\n\nMock log rows:\n${JSON.stringify(
      exampleRows,
      null,
      2,
    )}`;
  }

  private buildSystemPrompt(): string {
    return [
      '# Role: Autonomous Edge Security Analyst (AESA)',
      'You are a senior SOC Engineer at Cloudflare. Your goal is to investigate, analyze, and neutralize web-borne threats in real-time.',
      '',
      '# Environment:',
      '- You have access to `check_logs` (retrieves edge request logs).',
      '- You have access to `generate_waf_rule` (deploys a Cloudflare WAF Custom Rule).',
      '- You have access to `ask_user` (clarification).',
      '',
      '# Investigative SOP (Standard Operating Procedure):',
      '1. Triage: Analyze the initial symptom reported by the user.',
      '2. Evidence Gathering: If you lack specific ASN or payload evidence, call `check_logs`.',
      '3. Analysis: Identify the attack pattern (SQLi, XSS, DDoS, Credential Stuffing, etc.).',
      '4. Neutralization: Generate a precise WAF rule. Target ONLY the specific malicious pattern reported in the evidence.',
      '5. Reporting: Provide a clear technical reasoning in your response.',
      '',
      '# Guidelines:',
      '- You MUST ONLY output valid JSON (no markdown, no extra text).',
      '- Your output MUST match this exact JSON shape:',
      '  {',
      '    "action": "check_logs" | "generate_waf_rule" | "ask_user",',
      '    "reasoning": "...",',
      '    "parameters": {',
      '      "asn": number,',
      '      "payload": "string",',
      '      "severity": "high" | "medium" | "low",',
      '      "threat_type": "sql_injection" | "ddos" | "cross_site_scripting" | "other",',
      '      "question": "string (only if action is ask_user)"',
      '    }',
      '  }',
      '',
      '- Cloudflare WAF rule generation must target the specific ASN and the SQLi payload evidence (e.g., "UNION SELECT").',
    ].join('\n');
  }

  private buildUserPrompt(symptom: string, includeLogs: boolean, mockLogs: string | null): string {
    return [
      `Symptom reported by user:\n${symptom}`,
      '',
      'Investigation goal:',
      '- Determine whether there is a SQL injection attack pattern.',
      '- Extract the relevant ASN evidence and payload evidence.',
      '',
      includeLogs && mockLogs ? `Evidence (mock logs):\n${mockLogs}` : 'Evidence (mock logs): not provided yet.',
      '',
      'Decide the next action and respond using the required JSON shape.',
    ].join('\n');
  }

  private buildWafRuleFromParameters(parameters: Record<string, unknown>): Record<string, unknown> {
    // Phase 3 requirement: target ASN 13335 and the UNION SELECT payload (when present).
    const defaultAsn = 13335;
    const defaultPayload = 'UNION SELECT';

    const asn =
      typeof parameters.asn === 'number'
        ? parameters.asn
        : typeof parameters.asn === 'string' && parameters.asn.trim().length > 0
          ? Number(parameters.asn)
          : defaultAsn;

    const payload =
      typeof parameters.payload === 'string' && parameters.payload.trim().length > 0
        ? parameters.payload
        : defaultPayload;

    const lcPayload = payload.toLowerCase();

    return {
      kind: 'cloudflare_waf_rule',
      action: 'block',
      description: 'Auto-generated by Autonomous Edge Security Agent',
      expression: `ip.src.asnum eq ${asn} and (contains(tolower(http.request.body), "${lcPayload}") or contains(tolower(http.request.uri), "${lcPayload}"))`,
      target: {
        asn,
        payload,
      },
    };
  }

  private async queryLlmNextAction(symptom: string, includeLogs: boolean, mockLogs: string | null): Promise<LlmToolOutput> {
    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(symptom, includeLogs, mockLogs);

    const model = '@cf/meta/llama-3-8b-instruct';

    let result: any;
    let lastError: Error | null = null;
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        result = await this.env.AI.run(model as any, {
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.2,
          max_tokens: 512,
        });
        lastError = null;
        break;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        console.warn(`AI attempt ${attempt} failed: ${lastError.message}`);
        if (attempt < maxRetries) {
          // Exponential backoff
          await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
        }
      }
    }

    if (lastError) {
      throw new Error(`Inference persistently failed after ${maxRetries} attempts: ${lastError.message}`);
    }

    console.log('Raw LLM result:', JSON.stringify(result, null, 2));

    const raw =
      typeof result === 'string'
        ? result
        : typeof (result as any)?.response === 'string'
          ? (result as any).response
          : (result as any)?.response ?? result;

    const maybeParsed =
      typeof raw === 'string' && raw.length > 0 ? tryParseJsonMessage(raw) : raw;

    console.log('Parsed LLM response:', JSON.stringify(maybeParsed, null, 2));

    if (!maybeParsed || typeof maybeParsed !== 'object') {
      throw new Error('LLM response was not valid JSON or object.');
    }

    const parsed = maybeParsed as any;

    // Minimal runtime validation to keep the loop safe.
    const action = parsed.action;
    const reasoning = parsed.reasoning;
    const parameters = parsed.parameters;

    if (
      (action !== 'check_logs' && action !== 'generate_waf_rule' && action !== 'ask_user') ||
      typeof reasoning !== 'string' ||
      typeof parameters !== 'object' ||
      parameters === null
    ) {
      throw new Error('LLM JSON did not match required schema.');
    }

    return {
      action,
      reasoning,
      parameters: parameters as LlmToolOutput['parameters'],
    };
  }

  async runInvestigation(symptom: string): Promise<Record<string, unknown> | null> {
    const mockLogs = this.buildMockSqlInjectionLogs();
    let includeLogs = false;

    await this.broadcast({ step: 'thinking', message: 'Starting investigation...' });
    await this.appendHistory({
      ts: Date.now(),
      step: 'thinking',
      message: 'Starting investigation...',
      meta: { symptom },
    });

    const maxIterations = 6;
    for (let i = 0; i < maxIterations; i++) {
      const llmStep = `llm_iteration_${i + 1}`;
      const llmOutput = await this.queryLlmNextAction(symptom, includeLogs, includeLogs ? mockLogs : null);

      await this.appendHistory({
        ts: Date.now(),
        step: llmStep,
        message: `LLM action: ${llmOutput.action}`,
        meta: llmOutput,
      });

      await this.broadcast({
        step: llmStep,
        message: llmOutput.reasoning,
        action: llmOutput.action,
        parameters: llmOutput.parameters,
      });

      if (llmOutput.action === 'check_logs') {
        includeLogs = true;
        await this.broadcast({
          step: 'check_logs',
          message: 'Backend injecting mock logs into the model...',
        });
        continue;
      }

      if (llmOutput.action === 'ask_user') {
        await this.broadcast({
          step: 'ask_user',
          message: `LLM requested more info: ${(llmOutput.parameters as any)?.question ?? 'Additional information needed.'}`,
        });
        return null;
      }

      // generate_waf_rule
      const wafRule = this.buildWafRuleFromParameters(llmOutput.parameters);
      await this.appendHistory({
        ts: Date.now(),
        step: 'final_waf_rule',
        message: 'Generated WAF rule.',
        meta: { wafRule },
      });
      await this.broadcast({
        step: 'final_waf_rule',
        message: 'Generated WAF rule.',
        waf_rule: wafRule,
      });
      return wafRule;
    }

    await this.broadcast({
      step: 'error',
      message: 'Investigation did not converge within the iteration limit.',
    });
    return null;
  }

  async fetch(request: Request): Promise<Response> {
    const upgrade = request.headers.get('Upgrade');
    if (!upgrade || upgrade.toLowerCase() !== 'websocket') {
      return new Response('Expected websocket upgrade.', { status: 400 });
    }

    const pair = new WebSocketPair();
    const clientSocket = pair[0];
    const serverSocket = pair[1];

    const connectionId = crypto.randomUUID();

    // Accept the websocket and tag it so we can find it later for broadcast.
    this.ctx.acceptWebSocket(serverSocket, [
      'client',
      `connection:${connectionId}`,
    ]);

    await this.ctx.storage.put(`connection:${connectionId}`, {
      connectedAt: Date.now(),
      initialized: false,
    });

    const connections =
      ((await this.ctx.storage.get<string[]>('connections')) ?? []) as
        | string[]
        | undefined;

    const nextConnections = connections ? [...connections, connectionId] : [connectionId];
    await this.ctx.storage.put('connections', nextConnections);

    // Let the Worker respond with the client-side websocket.
    return new Response(null, { status: 101, webSocket: clientSocket });
  }

  override async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    const connectionId = this.getConnectionIdFromWs(ws);
    if (!connectionId) return;

    const raw = tryParseJsonMessage(message);
    if (raw === null || typeof raw !== 'object') {
      await this.broadcast({
        step: 'error',
        message: 'Invalid message format. Expected JSON.',
      });
      return;
    }

    const connectionRecord =
      (await this.ctx.storage.get<{ initialized: boolean }>(
        `connection:${connectionId}`,
      )) ?? { initialized: false };

    // First message must contain the user's reported symptom.
    if (!connectionRecord.initialized) {
      const symptom =
        (raw as { symptom?: unknown }).symptom ??
        (raw as { reported_symptom?: unknown }).reported_symptom ??
        (raw as { parameters?: { symptom?: unknown } }).parameters?.symptom;

      if (typeof symptom !== 'string' || symptom.trim().length === 0) {
        await this.broadcast({
          step: 'error',
          message: 'Missing required JSON field: `symptom` (string).',
        });
        return;
      }

      await this.ctx.storage.put(`connection:${connectionId}`, {
        ...connectionRecord,
        initialized: true,
        symptom,
      });

      await this.appendHistory({
        ts: Date.now(),
        step: 'received_symptom',
        message: `Received symptom: ${symptom}`,
        meta: { symptom },
      });

      await this.broadcast({
        step: 'received_symptom',
        message: 'Symptom received. Starting investigation...',
      });

      this.ctx.waitUntil(
        this.runInvestigation(symptom).catch(async (err) => {
          console.error('Investigation loop error:', err);
          await this.appendHistory({
            ts: Date.now(),
            step: 'runInvestigation_error',
            message: err instanceof Error ? err.message : String(err),
          });
          await this.broadcast({
            step: 'error',
            message: 'Investigation failed. Check backend logs for details.',
          });
        }),
      );

      return;
    }

    // Subsequent messages are stored as history records (for phase 3 replay/debug).
    await this.appendHistory({
      ts: Date.now(),
      step: 'client_message',
      message: 'Received additional input from client.',
      meta: { raw },
    });

    await this.broadcast({
      step: 'note',
      message: 'Additional input received.',
    });
  }

  override async webSocketClose(ws: WebSocket, _code: number, _reason: string, _wasClean: boolean) {
    const connectionId = this.getConnectionIdFromWs(ws);
    if (!connectionId) return;

    // Mark the connection as disconnected.
    const existing =
      (await this.ctx.storage.get<{ connectedAt: number; initialized: boolean }>(
        `connection:${connectionId}`,
      )) ?? { connectedAt: Date.now(), initialized: false };

    await this.ctx.storage.put(`connection:${connectionId}`, {
      ...existing,
      disconnectedAt: Date.now(),
    });
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    const upgrade = request.headers.get('Upgrade');
    if (upgrade && upgrade.toLowerCase() === 'websocket') {
      const ticketId = url.searchParams.get('ticketId') ?? 'default';
      const id = env.INVESTIGATION_TICKET.idFromName(ticketId);
      return env.INVESTIGATION_TICKET.get(id).fetch(request);
    }

    if (url.pathname === '/health') {
      try {
        const result = await env.AI.run('@cf/baai/bge-small-en-v1.5', {
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

    // Default HTTP handler (AI platform test)
    const tasks = [];
    const model = '@cf/meta/llama-3-8b-instruct';

    try {
      // prompt - simple completion style input
      let simple = {
        prompt: 'Tell me a joke about Cloudflare',
      };
      let response1 = await env.AI.run(model as any, simple);
      tasks.push({ inputs: simple, response: response1 });

      // messages - chat style input
      let chat = {
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Who won the world series in 2020?' },
        ],
      };
      let response2 = await env.AI.run(model as any, chat);
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
  },
};


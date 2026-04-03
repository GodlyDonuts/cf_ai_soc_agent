import { DurableObject } from 'cloudflare:workers';

import { tryParseJsonMessage } from './investigation';
import type { SocEnv } from './types';

type InvestigationHistoryEntry = {
  ts: number;
  step: string;
  message: string;
  meta?: Record<string, unknown>;
};

export class InvestigationTicket extends DurableObject<SocEnv> {
  private getConnectionIdFromWs(ws: WebSocket): string | null {
    for (const tag of this.ctx.getTags(ws)) {
      if (tag.startsWith('connection:')) return tag.slice('connection:'.length);
    }
    return null;
  }

  private async appendHistory(entry: InvestigationHistoryEntry): Promise<void> {
    const history = ((await this.ctx.storage.get('history')) ?? []) as InvestigationHistoryEntry[];
    history.push(entry);
    await this.ctx.storage.put('history', history);
  }

  async broadcast(data: object): Promise<void> {
    const payload = JSON.stringify(data);
    for (const ws of this.ctx.getWebSockets('client')) {
      try {
        ws.send(payload);
      } catch {
        // best-effort
      }
    }
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'POST' && url.pathname === '/broadcast') {
      const data = (await request.json()) as Record<string, unknown>;
      await this.broadcast(data);
      return Response.json({ ok: true });
    }

    const upgrade = request.headers.get('Upgrade');
    if (!upgrade || upgrade.toLowerCase() !== 'websocket') {
      return new Response('Expected websocket upgrade.', { status: 400 });
    }

    const ticketIdFromUrl = url.searchParams.get('ticketId') ?? 'default';
    await this.ctx.storage.put('meta:ticketId', ticketIdFromUrl);

    const pair = new WebSocketPair();
    const clientSocket = pair[0];
    const serverSocket = pair[1];

    const connectionId = crypto.randomUUID();

    this.ctx.acceptWebSocket(serverSocket, ['client', `connection:${connectionId}`]);

    await this.ctx.storage.put(`connection:${connectionId}`, {
      connectedAt: Date.now(),
      initialized: false,
    });

    const connections = ((await this.ctx.storage.get<string[]>('connections')) ?? []) as string[] | undefined;
    const nextConnections = connections ? [...connections, connectionId] : [connectionId];
    await this.ctx.storage.put('connections', nextConnections);

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
      (await this.ctx.storage.get<{ initialized: boolean }>(`connection:${connectionId}`)) ?? {
        initialized: false,
      };

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

      const ticketId =
        ((await this.ctx.storage.get<string>('meta:ticketId')) as string | null) ?? 'default';

      await this.appendHistory({
        ts: Date.now(),
        step: 'received_symptom',
        message: `Received symptom: ${symptom}`,
        meta: { symptom, ticketId },
      });

      await this.broadcast({
        step: 'received_symptom',
        message: 'Symptom received. Starting investigation workflow...',
      });

      this.ctx.waitUntil(
        this.env.INVESTIGATION_WORKFLOW.create({
          id: `inv-${crypto.randomUUID()}`,
          params: { ticketId, symptom },
        }).catch(async (err) => {
          console.error('Workflow start error:', err);
          await this.appendHistory({
            ts: Date.now(),
            step: 'workflow_start_error',
            message: err instanceof Error ? err.message : String(err),
          });
          await this.broadcast({
            step: 'error',
            message: 'Failed to start investigation workflow.',
          });
        }),
      );

      return;
    }

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

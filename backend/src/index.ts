// Phase 2 / Step 2:
// - Worker fetch handler forwards WebSocket upgrades to the InvestigationTicket Durable Object
// - Durable Object accepts the socket, persists connection + history in `this.ctx.storage`,
//   and streams status updates back to the client via `broadcast()`.

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

    return new Response(
      'This endpoint only supports websocket upgrades. Connect with `Upgrade: websocket`.',
      { status: 426 },
    );
  },
};


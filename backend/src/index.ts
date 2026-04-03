// Phase 1 scaffolding:
// - Workers fetch handler placeholder
// - Durable Object class stub for `InvestigationTicket`

export interface Env {
  AI: unknown;
  INVESTIGATION_TICKET: unknown;
}

export class InvestigationTicket {
  // `ctx` will be used in phase 2 for durable object storage + broadcasting.
  ctx: any;

  constructor(ctx: any, _env: Env) {
    this.ctx = ctx;
  }

  async fetch(_request: Request): Promise<Response> {
    return new Response("InvestigationTicket not implemented yet.", {
      status: 501,
    });
  }
}

export default {
  async fetch(_request: Request, _env: Env): Promise<Response> {
    return new Response(
      "cf_ai_soc_agent backend scaffold is running. Proceed to phase 2 for WebSockets + agent loop.",
      { status: 200 },
    );
  },
};


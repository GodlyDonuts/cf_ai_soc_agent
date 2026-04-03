/**
 * Minimal edge proxy that enforces KV blocks written by the SOC agent (asn:/ip: keys).
 * Deploy on a route or workers.dev and compare `cf-connecting-ip` / ASN to ACTIVE_BLOCKS.
 */
type EnforcementEnv = {
  ACTIVE_BLOCKS: KVNamespace;
};

export default {
  async fetch(request: Request, env: EnforcementEnv): Promise<Response> {
    const ip = request.headers.get('cf-connecting-ip') ?? '';
    const asn = (request as Request & { cf?: IncomingRequestCfProperties }).cf?.asn;

    if (ip) {
      const ipBlock = await env.ACTIVE_BLOCKS.get(`ip:${ip}`);
      if (ipBlock) {
        return new Response(JSON.stringify({ error: 'forbidden', reason: 'ip_block', ip }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    if (typeof asn === 'number') {
      const asnBlock = await env.ACTIVE_BLOCKS.get(`asn:${asn}`);
      if (asnBlock) {
        return new Response(JSON.stringify({ error: 'forbidden', reason: 'asn_block', asn }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        message: 'Request would be forwarded to origin in a full proxy deployment.',
        ip,
        asn: asn ?? null,
      }),
      { headers: { 'Content-Type': 'application/json' } },
    );
  },
};

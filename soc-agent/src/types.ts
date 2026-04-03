import type { Workflow } from '@cloudflare/workers-types';

export type LlmAction = 'check_logs' | 'generate_waf_rule' | 'ask_user';

export type LlmToolOutput = {
  action: LlmAction;
  reasoning: string;
  parameters: {
    asn?: number;
    payload?: string;
    severity?: 'high' | 'medium' | 'low';
    threat_type?: string;
    question?: string;
    /** Window for D1 log query */
    timeframe?: 'last_10_mins' | 'last_hour' | 'last_24h' | string;
    /** Substring match against signature / URI / body snippet */
    suspicious_keyword?: string;
  };
};

export type HttpLogRow = {
  ts: string;
  src_asn: number;
  src_ip: string;
  threat_type: string | null;
  signature: string | null;
  request_path: string;
  request_body_snippet: string | null;
  is_malicious: number;
};

export type InvestigationWorkflowParams = {
  ticketId: string;
  symptom: string;
};

export type SocEnv = {
  AI: Ai;
  INVESTIGATION_TICKET: DurableObjectNamespace;
  INVESTIGATION_WORKFLOW: Workflow<InvestigationWorkflowParams>;
  DB: D1Database;
  ACTIVE_BLOCKS: KVNamespace;
  VECTORIZE: VectorizeIndex;
  VITE_BACKEND_WS_URL?: string;
};

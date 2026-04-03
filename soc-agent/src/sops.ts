/** Short SOP excerpts for Vectorize RAG (titles + body). */
export const SECURITY_SOPS: { id: string; title: string; body: string }[] = [
  {
    id: 'sop-sqli',
    title: 'SQL injection at the edge',
    body:
      'Treat UNION/comment/boolean SQLi in URI or body as high severity. Correlate by ASN and payload signature. Prefer WAF blocks on ASN + payload substring before broad IP blocks.',
  },
  {
    id: 'sop-xss',
    title: 'Cross-site scripting (reflected)',
    body:
      'Look for script tags and event handlers in query strings. Block on suspicious patterns in http.request.uri and body. Escalate if repeated from single ASN.',
  },
  {
    id: 'sop-ddos',
    title: 'Layer 7 flood / DDoS symptoms',
    body:
      'If symptom mentions flood or rate, check logs for burst from few ASNs vs distributed. Use rate limiting and ASN blocks only with evidence from logs.',
  },
  {
    id: 'sop-creds',
    title: 'Credential stuffing',
    body:
      'Many failed logins from distributed IPs may share User-Agent or path. Block targeted paths and suspicious ASNs once confirmed in request logs.',
  },
  {
    id: 'sop-scan',
    title: 'Vulnerability scanning',
    body:
      'Paths like /.env, /wp-admin, or known CVE probes: block scanning ASNs after log confirmation; avoid blocking entire countries without evidence.',
  },
  {
    id: 'sop-data',
    title: 'Data exfiltration patterns',
    body:
      'Large responses or unusual export endpoints combined with SQLi indicators: prioritize blocking SQLi signatures first, then review ASN.',
  },
  {
    id: 'sop-bot',
    title: 'Malicious bots',
    body:
      'Headless clients and empty User-Agents hitting sensitive routes: combine bot score signals with log evidence before blocking.',
  },
  {
    id: 'sop-api',
    title: 'API abuse',
    body:
      '401/403 spikes or key stuffing on /api: narrow rules to path + method; use ASN block only when logs show concentrated source.',
  },
  {
    id: 'sop-ssrf',
    title: 'SSRF-like probes',
    body:
      'Requests with internal hostnames or metadata URLs in parameters: block payload patterns and review ASN from logs.',
  },
  {
    id: 'sop-lfi',
    title: 'Path traversal / LFI',
    body:
      'Sequences like ../ in URI should trigger WAF on path contains; confirm ASN from edge logs before escalation.',
  },
  {
    id: 'sop-rce',
    title: 'RCE attempt patterns',
    body:
      'Shell metacharacters in parameters: treat as critical; block payload substrings and ASN once verified in logs.',
  },
  {
    id: 'sop-chain',
    title: 'Incident handoff',
    body:
      'Document reasoning, evidence window, and rule expression. Prefer minimal blast radius: one ASN + one payload clause when possible.',
  },
];

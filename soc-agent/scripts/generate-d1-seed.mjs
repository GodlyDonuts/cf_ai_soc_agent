/**
 * Generates seed.sql with ~3000 synthetic http_logs rows in batches (D1 SQLITE_TOOBIG limit).
 * Run: node scripts/generate-d1-seed.mjs && npx wrangler d1 execute soc-logs --remote --file=./seed.sql
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(__dirname, '..', 'seed.sql');

const threats = ['sql_injection', 'xss', 'normal', 'ddos', 'credential_stuffing'];
const signatures = [
  'UNION SELECT',
  '<script>alert(1)</script>',
  'OR 1=1',
  'sleep(5)',
  '',
  '../../../etc/passwd',
  'SELECT * FROM users',
];
const paths = ['/api/search', '/login', '/admin', '/graphql', '/static/logo.png', '/health'];

function randItem(a) {
  return a[Math.floor(Math.random() * a.length)];
}

function randomIp() {
  return `203.0.${Math.floor(Math.random() * 200) + 1}.${Math.floor(Math.random() * 250) + 1}`;
}

function isoMinutesAgo(mins) {
  return new Date(Date.now() - mins * 60 * 1000).toISOString();
}

const BATCH = 150;
const parts = ['DELETE FROM http_logs;'];

for (let start = 0; start < 3200; start += BATCH) {
  const rows = [];
  const end = Math.min(start + BATCH, 3200);
  for (let i = start; i < end; i++) {
    const mins = Math.floor(Math.random() * 60 * 48);
    const tt = randItem(threats);
    const malicious = tt === 'normal' ? 0 : Math.random() > 0.15 ? 1 : 0;
    const asn =
      malicious && Math.random() > 0.4
        ? 13335
        : Math.floor(Math.random() * 50000) + 1000;
    const sig = malicious ? randItem(signatures.filter(Boolean)) : '';
    const path = randItem(paths);
    const body =
      malicious && tt === 'sql_injection'
        ? `q=1 ${sig} password FROM users`
        : malicious && tt === 'xss'
          ? `comment=${encodeURIComponent(sig)}`
          : 'ok=1';

    rows.push(
      `(${JSON.stringify(isoMinutesAgo(mins))}, ${asn}, ${JSON.stringify(randomIp())}, ${JSON.stringify(tt)}, ${JSON.stringify(sig || null)}, ${JSON.stringify(path)}, ${JSON.stringify(body)}, ${malicious})`,
    );
  }
  parts.push(
    `INSERT INTO http_logs (ts, src_asn, src_ip, threat_type, signature, request_path, request_body_snippet, is_malicious) VALUES\n${rows.join(',\n')};`,
  );
}

fs.writeFileSync(out, parts.join('\n\n'), 'utf8');
console.log(`Wrote batched seed (${3200} rows) to ${out}`);

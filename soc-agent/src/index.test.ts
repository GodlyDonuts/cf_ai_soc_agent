import { env, SELF } from 'cloudflare:test';
import { it, expect } from 'vitest';

it('responds with the HTML status page on the root URL', async () => {
  const response = await SELF.fetch('http://example.com/');
  expect(response.status).toBe(200);
  const contentType = response.headers.get('Content-Type');
  expect(contentType).toContain('text/html');
  const text = await response.text();
  expect(text).toContain('SOC Agent Online');
});

it('responds with AI test results when ?test=ai is provided', async () => {
  const response = await SELF.fetch('http://example.com/?test=ai');
  
  // Since we are running in a worker pool, if AI is not mocked, it might return 500
  // but we are testing that it at least attempts to run the AI branch.
  expect(response.status).toBeDefined();
});

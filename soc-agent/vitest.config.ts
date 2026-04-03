import { defineConfig } from 'vitest/config';
import { cloudflareTest } from '@cloudflare/vitest-pool-workers';

export default defineConfig({
  plugins: [
    cloudflareTest({
      configPath: './wrangler.jsonc',
      main: './src/index.ts',
    }),
  ],
  test: {
    // Other test options can be added here
  },
});

import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it('never defines server credentials in Next.js compile-time environment mappings', () => {
  const config = readFileSync(new URL('../next.config.ts', import.meta.url), 'utf8');
  expect(config).not.toMatch(/\bSUPABASE_SERVICE_ROLE_KEY\b/);
  const environment = config.split('env: {')[1]?.split('\n  },')[0];
  expect(environment).toBeDefined();
  const keys = [...environment!.matchAll(/^ {4}([A-Z_]+):/gm)].map(match => match[1]);
  expect(keys.length).toBeGreaterThan(0);
  expect(keys.every(key => key.startsWith('NEXT_PUBLIC_'))).toBe(true);
});

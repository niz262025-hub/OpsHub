import { describe, expect, it } from 'vitest';
import { isNonEmptyString } from './index';

describe('isNonEmptyString', () => {
  it('accepts meaningful strings', () => {
    expect(isNonEmptyString('OpsHub')).toBe(true);
  });

  it('rejects blank and non-string values', () => {
    expect(isNonEmptyString('  ')).toBe(false);
    expect(isNonEmptyString(null)).toBe(false);
  });
});

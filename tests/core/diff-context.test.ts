import { describe, it, expect } from 'vitest';
import { DiffContext } from '../../src/core/diff-context.js';

describe('DiffContext', () => {
  const dc = new DiffContext();

  describe('formatForPrompt', () => {
    it('returns empty string for no hunks', () => {
      expect(dc.formatForPrompt([])).toBe('');
    });

    it('formats hunks with file headers', () => {
      const hunks = [
        { file: 'src/app.ts', additions: 3, deletions: 1, patch: '@@ -1,5 +1,7 @@\n+new line\n old line' },
      ];
      const result = dc.formatForPrompt(hunks);
      expect(result).toContain('Changed Code');
      expect(result).toContain('src/app.ts');
      expect(result).toContain('+3/-1');
      expect(result).toContain('```diff');
    });

    it('truncates at 20K chars', () => {
      const bigPatch = 'x'.repeat(25_000);
      const hunks = [
        { file: 'big.ts', additions: 100, deletions: 0, patch: bigPatch },
        { file: 'small.ts', additions: 1, deletions: 0, patch: '+hello' },
      ];
      const result = dc.formatForPrompt(hunks);
      expect(result).toContain('truncated');
    });
  });

  describe('getUncommittedDiff', () => {
    it('returns array (may be empty if no changes)', () => {
      const result = dc.getUncommittedDiff();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getChangedFiles', () => {
    it('returns array of file paths', () => {
      const result = dc.getChangedFiles();
      expect(Array.isArray(result)).toBe(true);
    });
  });
});

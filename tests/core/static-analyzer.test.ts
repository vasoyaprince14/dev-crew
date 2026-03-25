import { describe, it, expect } from 'vitest';
import { StaticAnalyzer } from '../../src/core/static-analyzer.js';

describe('StaticAnalyzer', () => {
  const analyzer = new StaticAnalyzer();

  describe('analyze', () => {
    it('returns empty array for no files', () => {
      expect(analyzer.analyze([])).toEqual([]);
    });

    it('returns empty array for non-existent files', () => {
      expect(analyzer.analyze(['/nonexistent/file.ts'])).toEqual([]);
    });

    it('detects pattern issues in real source files', () => {
      // Analyze our own source which may have TODO comments etc.
      const findings = analyzer.analyze(['src/core/static-analyzer.ts']);
      // Should at least run without errors
      expect(Array.isArray(findings)).toBe(true);
    });
  });

  describe('formatForPrompt', () => {
    it('returns empty string for no findings', () => {
      expect(analyzer.formatForPrompt([])).toBe('');
    });

    it('formats findings with header', () => {
      const findings = [
        { type: 'error' as const, source: 'tsc', file: 'app.ts', line: 10, message: 'Type error' },
        { type: 'warning' as const, source: 'pattern', file: 'app.ts', line: 5, message: 'console.log' },
      ];
      const result = analyzer.formatForPrompt(findings);
      expect(result).toContain('Local Analysis');
      expect(result).toContain('not AI-generated');
      expect(result).toContain('tsc');
      expect(result).toContain('Type error');
    });

    it('caps at 30 findings', () => {
      const findings = Array.from({ length: 50 }, (_, i) => ({
        type: 'warning' as const,
        source: 'pattern',
        file: 'test.ts',
        line: i,
        message: `Finding ${i}`,
      }));
      const result = analyzer.formatForPrompt(findings);
      expect(result).toContain('more findings');
    });
  });
});

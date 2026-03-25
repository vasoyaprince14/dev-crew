import { describe, it, expect } from 'vitest';
import { TokenOptimizer } from '../../src/core/token-optimizer.js';

describe('TokenOptimizer', () => {
  const optimizer = new TokenOptimizer();

  describe('estimate', () => {
    it('estimates tokens from text length', () => {
      const text = 'hello world'; // 11 chars
      const tokens = optimizer.estimate(text);
      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeLessThan(20); // ~3 tokens
    });

    it('returns 0 for empty string', () => {
      expect(optimizer.estimate('')).toBe(0);
    });

    it('scales with text length', () => {
      const short = optimizer.estimate('short');
      const long = optimizer.estimate('a'.repeat(1000));
      expect(long).toBeGreaterThan(short);
    });
  });

  describe('compress', () => {
    it('removes excessive whitespace', () => {
      const input = 'line 1\n\n\n\n\nline 2';
      const result = optimizer.compress(input);
      // Should reduce blank lines
      expect(result.split('\n').filter(l => l.trim() === '').length).toBeLessThan(4);
    });

    it('preserves meaningful content', () => {
      const input = 'function foo() { return 42; }';
      const result = optimizer.compress(input);
      expect(result).toContain('function');
      expect(result).toContain('return');
    });

    it('handles empty string', () => {
      expect(optimizer.compress('')).toBe('');
    });
  });
});

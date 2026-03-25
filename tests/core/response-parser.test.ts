import { describe, it, expect } from 'vitest';
import { ResponseParser } from '../../src/core/response-parser.js';

describe('ResponseParser', () => {
  const parser = new ResponseParser();

  describe('parseReview', () => {
    it('parses JSON review response', () => {
      const raw = JSON.stringify({
        summary: 'Code looks good',
        issues: [{ severity: 'warning', message: 'Missing error handling', file: 'app.ts', line: 10 }],
        score: 7,
        suggestions: ['Add tests'],
      });
      const result = parser.parseReview(raw);
      expect(result.type).toBe('review');
      expect(result.summary).toBeTruthy();
    });

    it('handles plain text review', () => {
      const raw = 'The code has a few issues:\n- Missing error handling\n- No input validation';
      const result = parser.parseReview(raw);
      expect(result.type).toBe('review');
      expect(result.raw).toBe(raw);
    });
  });

  describe('parseGeneral', () => {
    it('parses JSON response', () => {
      const raw = JSON.stringify({ summary: 'Analysis complete', suggestions: ['Fix bug'] });
      const result = parser.parseGeneral(raw);
      expect(result.type).toBe('general');
      expect(result.summary).toBeTruthy();
    });

    it('handles plain text', () => {
      const raw = 'Here is my analysis of the code...';
      const result = parser.parseGeneral(raw);
      expect(result.type).toBe('general');
      expect(result.raw).toBe(raw);
    });
  });

  describe('JSON extraction', () => {
    it('extracts JSON from code blocks', () => {
      const raw = 'Here is the result:\n```json\n{"summary": "test"}\n```';
      const result = parser.parseGeneral(raw);
      expect(result.summary).toBeTruthy();
    });

    it('handles malformed JSON gracefully', () => {
      const raw = '{"broken json';
      const result = parser.parseGeneral(raw);
      expect(result.type).toBe('general');
      expect(result.raw).toBe(raw);
    });
  });
});

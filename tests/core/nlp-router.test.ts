import { describe, it, expect } from 'vitest';
import { parseNaturalInput } from '../../src/core/nlp-router.js';

describe('NLP Router', () => {
  const agentIds = [
    'review', 'fix', 'debug', 'test', 'ask', 'explain', 'onboard',
    'tech-lead', 'ba', 'cto', 'pr', 'security', 'designer',
    'devops', 'cost-optimizer', 'monitoring', 'performance',
    'accessibility', 'seo', 'flutter', 'react-native', 'ios', 'android',
  ];

  describe('direct match', () => {
    it('routes "review @src/app.ts" to review agent', () => {
      const result = parseNaturalInput('review @src/app.ts', agentIds);
      expect(result.agentId).toBe('review');
    });

    it('routes "fix @src/bug.ts" to fix agent', () => {
      const result = parseNaturalInput('fix @src/bug.ts', agentIds);
      expect(result.agentId).toBe('fix');
    });

    it('routes "test @src/service.ts" to test agent', () => {
      const result = parseNaturalInput('test @src/service.ts', agentIds);
      expect(result.agentId).toBe('test');
    });
  });

  describe('keyword matching', () => {
    it('routes security-related queries to security agent', () => {
      const result = parseNaturalInput('check for SQL injection vulnerabilities', agentIds);
      expect(result.agentId).toBe('security');
    });

    it('routes performance questions to performance agent', () => {
      const result = parseNaturalInput('how can I optimize the performance', agentIds);
      expect(result.agentId).toBe('performance');
    });
  });

  describe('fallback', () => {
    it('falls back to ask agent for generic queries', () => {
      const result = parseNaturalInput('what time is it', agentIds);
      expect(result.agentId).toBe('ask');
    });
  });

  describe('file extraction', () => {
    it('extracts file paths from input', () => {
      const result = parseNaturalInput('review @src/app.ts', agentIds);
      expect(result.filePath).toBeTruthy();
    });
  });
});

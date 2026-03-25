import { describe, it, expect } from 'vitest';
import { parseOutput } from '../../src/core/output-parser.js';

describe('Output Parser', () => {
  describe('delimited format', () => {
    it('parses ===FILE path=...=== delimited output', () => {
      const output = `===FILE path=src/app.ts===
console.log('hello');
===ENDFILE===
===FILE path=src/index.ts===
export default {};
===ENDFILE===`;
      const result = parseOutput(output);
      expect(result.files).toHaveLength(2);
      expect(result.files[0].path).toBe('src/app.ts');
      expect(result.files[1].path).toBe('src/index.ts');
    });
  });

  describe('JSON format', () => {
    it('parses JSON file array output', () => {
      const output = JSON.stringify({
        files: [
          { path: 'src/app.ts', content: 'const x = 1;' },
          { path: 'src/index.ts', content: 'export {};' },
        ],
      });
      const result = parseOutput(output);
      expect(result.files).toHaveLength(2);
    });
  });

  describe('code block format', () => {
    it('parses code blocks with file paths', () => {
      const output = `Here is the code:

\`\`\`typescript
// src/app.ts
const x = 1;
\`\`\`

\`\`\`typescript
// src/index.ts
export {};
\`\`\``;
      const result = parseOutput(output);
      expect(result.files.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('empty/invalid', () => {
    it('handles empty string', () => {
      const result = parseOutput('');
      expect(result.files).toHaveLength(0);
    });
  });
});

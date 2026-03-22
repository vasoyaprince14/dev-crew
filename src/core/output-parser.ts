/**
 * Deterministic output parser for the ===FILE=== format.
 *
 * Replaces fragile JSON regex extraction with a delimiter-based format
 * that is trivial to parse and impossible to confuse with file content.
 *
 * Fallback chain: ===FILE=== → JSON → code blocks
 */

import type { GeneratedFile } from './file-writer.js';

export interface ParsedOutput {
  projectName: string;
  files: GeneratedFile[];
}

/**
 * Parse AI output into structured files.
 * Tries ===FILE=== format first, falls back to JSON, then code blocks.
 */
export function parseOutput(raw: string): ParsedOutput {
  // Strategy 1: ===FILE=== delimited format (preferred)
  const delimited = parseDelimitedFormat(raw);
  if (delimited.files.length > 0) {
    return delimited;
  }

  // Strategy 2: JSON format (backward compatibility)
  const json = parseJSONFormat(raw);
  if (json.files.length > 0) {
    return json;
  }

  // Strategy 3: Code blocks with filepath comments
  const codeBlocks = parseCodeBlockFormat(raw);
  return codeBlocks;
}

/**
 * Parse ===FILE path=...=== delimited format.
 * This is the primary format — deterministic and robust.
 */
function parseDelimitedFormat(raw: string): ParsedOutput {
  let projectName = 'my-app';
  const files: GeneratedFile[] = [];

  // Extract project name
  const nameMatch = raw.match(/===PROJECT\s+name=(.+?)===/);
  if (nameMatch) {
    projectName = nameMatch[1].trim();
  }

  // Extract files
  const filePattern = /===FILE\s+path=(.+?)===\n([\s\S]*?)===ENDFILE===/g;
  let match;

  while ((match = filePattern.exec(raw)) !== null) {
    const filePath = match[1].trim();
    // Preserve content exactly, just trim trailing whitespace
    const content = match[2].replace(/\n$/, '');
    if (filePath && content) {
      files.push({ path: filePath, content });
    }
  }

  return { projectName, files };
}

/**
 * Parse JSON format: { "files": [{ "path": "...", "content": "..." }] }
 * Tries raw parse, code block extraction, and greedy object match.
 */
function parseJSONFormat(raw: string): ParsedOutput {
  let projectName = 'my-app';
  const files: GeneratedFile[] = [];

  const parsed = tryParseJSON(raw);
  if (!parsed) return { projectName, files };

  if (parsed.project_name) {
    projectName = String(parsed.project_name);
  }

  if (Array.isArray(parsed.files)) {
    for (const f of parsed.files) {
      if (f && typeof f === 'object' && 'path' in f && 'content' in f) {
        const file = f as { path: string; content: string; description?: string };
        if (file.path && file.content) {
          files.push({
            path: file.path,
            content: file.content,
            description: file.description,
          });
        }
      }
    }
  }

  return { projectName, files };
}

function tryParseJSON(raw: string): Record<string, unknown> | null {
  // Direct parse
  try {
    return JSON.parse(raw);
  } catch { /* fall through */ }

  // Code block extraction
  const codeBlockMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1]);
    } catch { /* fall through */ }
  }

  // Greedy object match
  const objMatch = raw.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try {
      return JSON.parse(objMatch[0]);
    } catch { /* fall through */ }
  }

  return null;
}

/**
 * Parse code blocks with filepath comments:
 *   ```typescript
 *   // filepath: src/app.ts
 *   ...
 *   ```
 */
function parseCodeBlockFormat(raw: string): ParsedOutput {
  const files: GeneratedFile[] = [];
  const pattern = /```[\w]*\s*\n\s*\/\/\s*(?:filepath|file|path):\s*(.+?)\n([\s\S]*?)```/g;
  let match;

  while ((match = pattern.exec(raw)) !== null) {
    const filePath = match[1].trim();
    const content = match[2].trim();
    if (filePath && content) {
      files.push({ path: filePath, content });
    }
  }

  return { projectName: 'my-app', files };
}

/**
 * Format files as a string for sending back to AI in fix prompts.
 * Uses the ===FILE=== format so the AI sees what format to use.
 */
export function formatFilesForPrompt(files: GeneratedFile[], maxChars = 30000): string {
  const parts: string[] = [];
  let totalChars = 0;

  for (const file of files) {
    const block = `===FILE path=${file.path}===\n${file.content}\n===ENDFILE===`;
    if (totalChars + block.length > maxChars) {
      parts.push(`(${files.length - parts.length} more files omitted for token efficiency)`);
      break;
    }
    parts.push(block);
    totalChars += block.length;
  }

  return parts.join('\n\n');
}

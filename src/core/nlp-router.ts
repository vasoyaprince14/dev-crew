// ---------------------------------------------------------------------------
// Natural Language Router
// Maps user input to the correct agent via direct match, keyword matching,
// or fallback to the 'ask' agent.
// ---------------------------------------------------------------------------

export interface ParsedInput {
  agentId: string;
  query: string;
  filePath?: string;
}

// ---------------------------------------------------------------------------
// Keyword → agent-id mapping
// ---------------------------------------------------------------------------

const KEYWORD_MAP: Array<{ keywords: string[]; agentId: string }> = [
  { keywords: ['review', 'check', 'audit', 'analyze', 'scan'], agentId: 'review' },
  { keywords: ['fix', 'repair', 'patch', 'correct', 'solve'], agentId: 'fix' },
  { keywords: ['debug', 'error', 'failing', 'crash', 'broken', 'not working', 'why is'], agentId: 'debug' },
  { keywords: ['test', 'write tests', 'generate tests', 'spec', 'coverage'], agentId: 'test' },
  { keywords: ['explain', 'what does', 'how does', 'understand'], agentId: 'explain' },
  { keywords: ['secure', 'security', 'vulnerability', 'owasp'], agentId: 'security' },
  { keywords: ['deploy', 'devops', 'docker', 'ci-cd', 'pipeline', 'kubernetes'], agentId: 'devops' },
  { keywords: ['cost', 'expensive', 'bill', 'pricing', 'save money'], agentId: 'cost-optimizer' },
  { keywords: ['onboard', 'new developer', 'getting started'], agentId: 'onboard' },
  { keywords: ['architect', 'design', 'structure', 'refactor', 'tech-lead'], agentId: 'tech-lead' },
  { keywords: ['requirement', 'user story', 'feature request', 'business'], agentId: 'ba' },
  { keywords: ['pr', 'pull request', 'merge request'], agentId: 'pr' },
  { keywords: ['flutter', 'dart'], agentId: 'flutter' },
  { keywords: ['react native', 'rn'], agentId: 'react-native' },
  { keywords: ['ios', 'swift', 'swiftui'], agentId: 'ios' },
  { keywords: ['android', 'kotlin', 'jetpack'], agentId: 'android' },
  { keywords: ['performance', 'slow', 'speed', 'optimize'], agentId: 'performance' },
  { keywords: ['accessibility', 'a11y', 'wcag', 'aria'], agentId: 'accessibility' },
  { keywords: ['database', 'schema', 'migration', 'query'], agentId: 'db-architect' },
  { keywords: ['api', 'endpoint', 'rest', 'graphql'], agentId: 'api-architect' },
  { keywords: ['monitor', 'alert', 'logging', 'observability'], agentId: 'monitoring' },
  { keywords: ['scaffold', 'build', 'full stack', 'fullstack'], agentId: 'fullstack-builder' },
];

// ---------------------------------------------------------------------------
// File-path detection
// ---------------------------------------------------------------------------

/**
 * Attempt to extract a file path from the input string.
 * Matches common patterns like `src/foo/bar.ts`, `./lib/index.js`,
 * `/absolute/path.py`, or Windows-style `C:\dir\file.ts`.
 */
function extractFilePath(input: string): string | undefined {
  // Match typical file paths (relative or absolute) containing at least one
  // slash or backslash followed by a filename with an extension.
  const match = input.match(
    /(?:^|\s)(\.{0,2}[\\/]?(?:[\w.@-]+[\\/])+[\w.@-]+\.[\w]+)/,
  );
  return match?.[1];
}

// ---------------------------------------------------------------------------
// Main parser
// ---------------------------------------------------------------------------

/**
 * Parse free-form user input and resolve which agent should handle it.
 *
 * Resolution order:
 * 1. Direct match – input starts with a known agent id (e.g. "review src/app.ts")
 * 2. Keyword match – first keyword found in input maps to an agent
 * 3. Fallback – route to the 'ask' agent (codebase Q&A)
 */
export function parseNaturalInput(
  input: string,
  knownAgentIds: string[],
): ParsedInput {
  const trimmed = input.trim();
  const lower = trimmed.toLowerCase();

  // ------------------------------------------------------------------
  // 1. Direct agent-id prefix match
  //    e.g. "review src/app.ts" → agentId='review', query='src/app.ts'
  // ------------------------------------------------------------------
  for (const id of knownAgentIds) {
    if (lower.startsWith(id + ' ') || lower === id) {
      const query = trimmed.slice(id.length).trim();
      return {
        agentId: id,
        query: query || trimmed,
        filePath: extractFilePath(query),
      };
    }
  }

  // ------------------------------------------------------------------
  // 2. Keyword matching (multi-word keywords checked first)
  //    Sort entries so that longer (multi-word) keywords are tested
  //    before shorter ones to avoid false positives.
  // ------------------------------------------------------------------
  for (const entry of KEYWORD_MAP) {
    // Check multi-word keywords first (sorted longest-first)
    const sorted = [...entry.keywords].sort((a, b) => b.length - a.length);
    for (const keyword of sorted) {
      if (lower.includes(keyword)) {
        return {
          agentId: entry.agentId,
          query: trimmed,
          filePath: extractFilePath(trimmed),
        };
      }
    }
  }

  // ------------------------------------------------------------------
  // 3. Fallback → 'ask' agent
  // ------------------------------------------------------------------
  return {
    agentId: 'ask',
    query: trimmed,
    filePath: extractFilePath(trimmed),
  };
}

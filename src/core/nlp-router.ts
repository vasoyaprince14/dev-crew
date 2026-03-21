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

// Each keyword entry can use:
//   - plain string: matched with word boundaries (won't match inside other words)
//   - string starting with "=": exact phrase match (no word boundary)
const KEYWORD_MAP: Array<{ keywords: string[]; agentId: string }> = [
  { keywords: ['pull request', 'merge request', 'pr review', 'review pr'], agentId: 'pr' },
  { keywords: ['review', 'code review', 'check code', 'audit code', 'analyze'], agentId: 'review' },
  { keywords: ['fix', 'repair', 'patch', 'correct', 'solve'], agentId: 'fix' },
  { keywords: ['debug', 'error', 'failing', 'crash', 'broken', 'not working', 'why is', 'bug'], agentId: 'debug' },
  { keywords: ['test', 'write tests', 'generate tests', 'spec', 'coverage', 'unit test'], agentId: 'test' },
  { keywords: ['explain', 'what does', 'how does', 'understand', 'what is', 'about', 'tell me', 'document', 'documentation'], agentId: 'explain' },
  { keywords: ['secure', 'security', 'vulnerability', 'owasp', 'xss', 'injection'], agentId: 'security' },
  { keywords: ['deploy', 'devops', 'docker', 'ci-cd', 'pipeline', 'kubernetes', 'k8s'], agentId: 'devops' },
  { keywords: ['cost', 'expensive', 'bill', 'pricing', 'save money', 'cloud cost'], agentId: 'cost-optimizer' },
  { keywords: ['onboard', 'new developer', 'getting started', 'setup guide'], agentId: 'onboard' },
  { keywords: ['architect', 'architecture', 'design pattern', 'refactor', 'tech lead'], agentId: 'tech-lead' },
  { keywords: ['requirement', 'user story', 'feature request', 'business requirement'], agentId: 'ba' },
  { keywords: ['flutter', 'dart widget'], agentId: 'flutter' },
  { keywords: ['react native', 'react-native'], agentId: 'react-native' },
  { keywords: ['ios', 'swift', 'swiftui', 'xcode'], agentId: 'ios' },
  { keywords: ['android', 'kotlin', 'jetpack'], agentId: 'android' },
  { keywords: ['performance', 'slow', 'speed up', 'optimize', 'perf audit'], agentId: 'performance' },
  { keywords: ['accessibility', 'a11y', 'wcag', 'aria', 'screen reader'], agentId: 'accessibility' },
  { keywords: ['database', 'schema', 'migration', 'sql query', 'db design'], agentId: 'db-architect' },
  { keywords: ['api design', 'endpoint', 'rest api', 'graphql', 'api review'], agentId: 'api-architect' },
  { keywords: ['monitor', 'alert', 'logging', 'observability', 'metrics'], agentId: 'monitoring' },
  { keywords: ['scaffold', 'full stack', 'fullstack', 'generate project'], agentId: 'fullstack-builder' },
  { keywords: ['create app', 'build app', 'build me', 'create project', 'new app', 'vibe code', 'vibe coding', 'generate app'], agentId: 'app-creator' },
  { keywords: ['build database', 'create schema', 'generate migration', 'seed data', 'db builder'], agentId: 'db-builder' },
  { keywords: ['slow query', 'query performance', 'db analytics', 'database analytics', 'index optimization'], agentId: 'db-analytics' },
  { keywords: ['ui design', 'design system', 'component library', 'generate ui', 'ui designer'], agentId: 'ui-designer' },
  { keywords: ['bundle size', 'web vitals', 'ui analytics', 'frontend performance', 'lighthouse'], agentId: 'ui-analytics' },
  { keywords: ['seo', 'meta tags', 'sitemap', 'search engine', 'open graph', 'structured data'], agentId: 'seo' },
  { keywords: ['landing page', 'homepage', 'marketing page', 'hero section'], agentId: 'landing-page' },
  { keywords: ['authentication', 'login system', 'signup', 'oauth', 'jwt', 'auth'], agentId: 'auth-architect' },
  { keywords: ['payment', 'stripe', 'billing', 'subscription', 'checkout', 'invoice'], agentId: 'payment' },
  { keywords: ['launch', 'go live', 'production ready', 'ship it', 'production checklist'], agentId: 'launch' },
  { keywords: ['pitch deck', 'investor', 'fundraising', 'pitch'], agentId: 'pitch' },
  { keywords: ['email template', 'transactional email', 'email setup', 'newsletter'], agentId: 'email-builder' },
  { keywords: ['tech stack', 'which framework', 'recommend stack', 'solution architect', 'what technology'], agentId: 'solution-architect' },
  { keywords: ['marketing', 'go to market', 'product hunt', 'content strategy', 'social media'], agentId: 'marketing' },
  { keywords: ['product roadmap', 'feature priority', 'product metrics', 'product analyst', 'north star'], agentId: 'product-analyst' },
  { keywords: ['growth strategy', 'revenue', 'startup advice', 'unit economics', 'hiring plan', 'okr'], agentId: 'growth' },
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
  // 2. Keyword matching with word-boundary awareness
  //    Multi-word keywords checked first (longest match wins).
  //    Single-word keywords use word boundaries to prevent false
  //    positives (e.g. "pr" matching inside "project").
  // ------------------------------------------------------------------
  for (const entry of KEYWORD_MAP) {
    const sorted = [...entry.keywords].sort((a, b) => b.length - a.length);
    for (const keyword of sorted) {
      // Multi-word keywords: simple includes is safe
      if (keyword.includes(' ')) {
        if (lower.includes(keyword)) {
          return {
            agentId: entry.agentId,
            query: trimmed,
            filePath: extractFilePath(trimmed),
          };
        }
      } else {
        // Single-word: use word boundary regex to avoid partial matches
        const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
        if (regex.test(lower)) {
          return {
            agentId: entry.agentId,
            query: trimmed,
            filePath: extractFilePath(trimmed),
          };
        }
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

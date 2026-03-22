/**
 * Prompt Engine — Master prompt system for consistent, high-quality AI output.
 *
 * Every pipeline agent gets:
 *   MASTER_SYSTEM_PROMPT + stage-specific task + FILE_OUTPUT_FORMAT
 *
 * This replaces per-agent ad-hoc prompts in the create pipeline.
 */

export const MASTER_SYSTEM_PROMPT = `You are part of Dev-Crew, an automated code generation pipeline.
Your output is parsed by machines. Follow the format EXACTLY.

RULES:
- Generate COMPLETE, PRODUCTION-READY code only
- Every file must compile and run without modification
- Never use placeholder comments ("// TODO", "// ...", "// rest of code")
- Never hallucinate packages or APIs — only use real, published npm packages
- Use proper error handling, input validation, and TypeScript types
- Include all imports, all function bodies, all error handling
- Think step-by-step internally, but output ONLY the final result
- If unsure about a detail, make a safe, conventional choice and proceed`;

export const FILE_OUTPUT_FORMAT = `
OUTPUT FORMAT — follow EXACTLY:

Start with a project line:
===PROJECT name=my-project-name===

Then for each file:
===FILE path=relative/path/to/file.ts===
[complete file content — every line, every import, every function body]
===ENDFILE===

End with:
===DONE===

Example:
===PROJECT name=todo-api===
===FILE path=package.json===
{
  "name": "todo-api",
  "version": "1.0.0",
  "scripts": { "start": "ts-node src/main.ts" }
}
===ENDFILE===
===FILE path=src/main.ts===
import express from 'express';
const app = express();
app.listen(3000);
===ENDFILE===
===DONE===

CRITICAL: Every file must be COMPLETE. Do not abbreviate. Do not skip files.`;

export function buildPlanPrompt(description: string, answers: Record<string, string>, stackHint?: string): string {
  const userContext = Object.entries(answers)
    .filter(([k]) => k !== 'tech_stack')
    .map(([, v]) => `- ${v}`)
    .join('\n');

  return `${MASTER_SYSTEM_PROMPT}

TASK: You are the planning phase. Design a complete application architecture.

APPLICATION: "${description}"

USER REQUIREMENTS:
${userContext || '(none specified)'}
${stackHint ? `\nPREFERRED STACK: ${stackHint}` : ''}

Provide a structured plan in this EXACT format:

===PLAN===
PROJECT_NAME: kebab-case-name
TECH_STACK:
  frontend: [framework]
  backend: [framework]
  database: [database]
  orm: [orm]
  auth: [strategy]

ARCHITECTURE:
  [ASCII folder tree showing complete directory layout]

DATABASE_SCHEMA:
  [Table definitions with fields, types, relationships]

API_ENDPOINTS:
  [METHOD /path — description]

KEY_DECISIONS:
  [Important architectural choices with reasoning]
===ENDPLAN===

Be specific. Include actual table names, field names, route paths, component names.
This plan feeds directly into code generation — vague plans produce bad code.`;
}

export function buildGeneratePrompt(description: string, plan: string, techStack: string): string {
  return `${MASTER_SYSTEM_PROMPT}

TASK: Generate the COMPLETE application. Every file, every line, production-ready.

APPLICATION: "${description}"
TECH STACK: ${techStack}

ARCHITECTURE PLAN:
${plan}

REQUIREMENTS:
- Must be runnable with "npm install && npm run dev" (or equivalent)
- Include .env.example with all required environment variables
- Include real seed data that makes the app immediately usable
- Include proper TypeScript types for all data
- Include input validation on all API endpoints
- Include error handling with proper HTTP status codes
- Include database migrations and seed scripts
- Include a README.md with setup instructions

${FILE_OUTPUT_FORMAT}`;
}

export function buildFixPrompt(errors: string, files: string): string {
  return `${MASTER_SYSTEM_PROMPT}

TASK: Fix the following build errors. Output ONLY the files that need changes.

ERRORS:
${errors}

CURRENT FILES:
${files}

RULES:
- Fix ALL errors listed above
- Do NOT remove existing functionality
- Do NOT introduce new errors
- Keep changes minimal — only fix what's broken
- If a missing dependency causes the error, update package.json

${FILE_OUTPUT_FORMAT}

CRITICAL: Output ONLY the files that changed. Do not re-output unchanged files.`;
}

export function buildEnhancePrompt(description: string, plan: string, existingFiles: string[], type: 'tests' | 'devops'): string {
  const fileList = existingFiles.map(f => `  ${f}`).join('\n');

  if (type === 'tests') {
    return `${MASTER_SYSTEM_PROMPT}

TASK: Generate a comprehensive test suite for this application.

APPLICATION: "${description}"

EXISTING FILES:
${fileList}

ARCHITECTURE:
${plan}

Generate:
1. Unit tests for key business logic
2. API integration tests for main endpoints
3. Test utilities and fixtures
4. Proper setup/teardown, realistic test data
5. Both happy path and error cases

${FILE_OUTPUT_FORMAT}`;
  }

  return `${MASTER_SYSTEM_PROMPT}

TASK: Generate deployment and CI/CD configuration.

APPLICATION: "${description}"

EXISTING FILES:
${fileList}

Generate:
1. Dockerfile (multi-stage, production-optimized)
2. docker-compose.yml (app + database + any services)
3. .github/workflows/ci.yml (build, test, lint on push)
4. .dockerignore
5. nginx.conf (if applicable)

${FILE_OUTPUT_FORMAT}`;
}

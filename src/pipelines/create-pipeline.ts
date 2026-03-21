import chalk from 'chalk';
import { AgentRegistry } from '../agents/registry.js';
import { ConfigManager } from '../core/config-manager.js';
import { ActionLayer } from '../core/action-layer.js';
import { Spinner } from '../utils/spinner.js';
import type { GeneratedFile } from '../core/file-writer.js';
import type { ProjectInfo } from '../types/config.js';

export interface CreateSpec {
  description: string;
  refinedDescription: string;
  techStack: string;
  features: string[];
  answers: Record<string, string>;
}

interface PipelineStage {
  name: string;
  agent: string;
  icon: string;
  description: string;
  maxTokens: number;
  buildQuery: (spec: CreateSpec, prev: Map<string, string>) => string;
}

export interface PipelineResult {
  files: GeneratedFile[];
  setupSteps: string[];
  projectName: string;
  totalTokens: number;
  totalDuration: number;
  stagesCompleted: number;
}

export class CreatePipeline {
  private registry: AgentRegistry;
  private configManager: ConfigManager;
  private projectInfo: ProjectInfo;
  private actionLayer: ActionLayer;
  private spinner: Spinner;
  private skipConfirm: boolean;

  constructor(projectInfo: ProjectInfo, skipConfirm = false) {
    this.registry = new AgentRegistry();
    this.configManager = new ConfigManager();
    this.projectInfo = projectInfo;
    this.actionLayer = new ActionLayer();
    this.spinner = new Spinner();
    this.skipConfirm = skipConfirm;
  }

  async run(spec: CreateSpec): Promise<PipelineResult> {
    const stages = this.getStages();
    const stageResults = new Map<string, string>();
    const allFiles: GeneratedFile[] = [];
    let setupSteps: string[] = [];
    let projectName = 'my-app';
    let totalTokens = 0;
    let totalDuration = 0;
    let stagesCompleted = 0;

    console.log();
    console.log(chalk.bold.cyan('  Build Pipeline'));
    console.log(chalk.cyan('  ' + '='.repeat(50)));

    for (let i = 0; i < stages.length; i++) {
      const stage = stages[i];

      console.log();
      console.log(chalk.bold(`  ${stage.icon} Step ${i + 1}/${stages.length}: ${stage.name}`));
      console.log(chalk.dim(`  ${stage.description}`));

      const agent = this.registry.create(
        stage.agent,
        this.projectInfo,
        { maxTokens: stage.maxTokens },
        this.configManager.getFeedback(stage.agent),
      );

      if (!agent) {
        console.log(chalk.yellow(`  Skipping — ${stage.agent} agent not available`));
        stageResults.set(stage.name, '');
        continue;
      }

      this.spinner.start(`  Working on ${stage.name.toLowerCase()}...`);

      try {
        const query = stage.buildQuery(spec, stageResults);
        const result = await agent.execute({
          query,
          streaming: false,
        });

        this.spinner.stop();
        stagesCompleted++;
        totalTokens += result.tokensUsed || 0;
        totalDuration += result.duration;
        stageResults.set(stage.name, result.raw);

        // Extract files from scaffolding stages
        if (stage.agent === 'app-creator' || stage.agent === 'fullstack-builder') {
          const parsed = this.extractJSON(result.raw);
          if (parsed) {
            if (parsed.project_name) projectName = String(parsed.project_name);
            if (Array.isArray(parsed.files)) {
              const files = parsed.files as Array<{ path: string; content: string; description?: string }>;
              for (const f of files) {
                if (f.path && f.content) {
                  allFiles.push({ path: f.path, content: f.content, description: f.description });
                }
              }
            }
            if (Array.isArray(parsed.setup_steps)) {
              setupSteps = parsed.setup_steps as string[];
            }
          }
        } else {
          // Extract code blocks from non-JSON responses (test, devops, etc.)
          const extracted = this.extractFilesFromCodeBlocks(result.raw);
          allFiles.push(...extracted);
        }

        // Show brief summary
        const fileCount = stage.agent === 'app-creator' ? ` (${allFiles.length} files)` : '';
        console.log(chalk.green(`  Done${fileCount} — ${(result.duration / 1000).toFixed(1)}s`));

        // Ask to continue (except last step)
        if (i < stages.length - 1 && !this.skipConfirm) {
          const proceed = await this.actionLayer.confirm('\n  Continue to next step?');
          if (!proceed) {
            console.log(chalk.yellow('  Pipeline stopped by user.'));
            break;
          }
        }
      } catch (err) {
        this.spinner.fail(`${stage.name} failed`);
        const msg = err instanceof Error ? err.message : String(err);
        console.log(chalk.red(`  Error: ${msg}`));
        stageResults.set(stage.name, '');

        if (i < stages.length - 1) {
          const continueAnyway = await this.actionLayer.confirm('  Continue with next step?');
          if (!continueAnyway) break;
        }
      }
    }

    // Deduplicate files — later stages override earlier ones
    const deduped = this.deduplicateFiles(allFiles);

    return {
      files: deduped,
      setupSteps,
      projectName,
      totalTokens,
      totalDuration,
      stagesCompleted,
    };
  }

  private getStages(): PipelineStage[] {
    return [
      {
        name: 'Solution Design',
        agent: 'solution-architect',
        icon: '\u{1F9E0}',
        description: 'Recommending optimal tech stack for your requirements',
        maxTokens: 8192,
        buildQuery: (spec) => {
          return `Recommend the best tech stack for this application:

"${spec.description}"

User preferences:
${Object.entries(spec.answers).map(([k, v]) => `- ${v}`).join('\n')}
${spec.techStack !== 'Node.js + React + PostgreSQL' ? `\nUser prefers: ${spec.techStack}` : ''}

Consider: scalability, developer speed, community support, cost, and the specific requirements above. Recommend frontend, backend, database, auth, payments, hosting, and any other relevant services.`;
        },
      },
      {
        name: 'Requirements',
        agent: 'ba',
        icon: '\u{1F4CB}',
        description: 'Analyzing requirements and creating specs',
        maxTokens: 8192,
        buildQuery: (spec, prev) => {
          const solutionDesign = prev.get('Solution Design') || '';
          return `Create a complete product requirements document for this application:

"${spec.description}"

User Requirements:
${Object.entries(spec.answers).map(([k, v]) => `- ${v}`).join('\n')}

Tech Stack: ${spec.techStack}
${solutionDesign ? `\nSolution Architecture:\n${this.truncate(solutionDesign, 2000)}` : ''}

Provide:
1. Core user stories (who, what, why)
2. Data model (entities, relationships, key fields)
3. API endpoints needed (method, path, purpose)
4. Authentication/authorization requirements
5. Third-party integrations needed
6. MVP scope vs future features

Be specific and actionable — this feeds directly into code generation.`;
        },
      },
      {
        name: 'Architecture',
        agent: 'tech-lead',
        icon: '\u{1F3D7}',
        description: 'Designing system architecture',
        maxTokens: 8192,
        buildQuery: (spec, prev) => {
          const requirements = prev.get('Requirements') || 'N/A';
          return `Design the complete technical architecture for this application:

"${spec.description}"

Tech Stack: ${spec.techStack}

Requirements:
${this.truncate(requirements, 4000)}

Provide:
1. Project folder structure (feature-based)
2. Database schema design (tables, relationships, indexes)
3. API route structure
4. Authentication flow
5. Key architectural decisions and patterns
6. Component hierarchy (if frontend)

Be specific — include actual table names, route paths, component names.`;
        },
      },
      {
        name: 'Code Generation',
        agent: 'app-creator',
        icon: '\u{1F680}',
        description: 'Generating complete application code',
        maxTokens: 16384,
        buildQuery: (spec, prev) => {
          const requirements = prev.get('Requirements') || '';
          const architecture = prev.get('Architecture') || '';
          return `Generate the COMPLETE application with ALL file contents. Every file must be production-ready and runnable.

Application: "${spec.description}"
Tech Stack: ${spec.techStack}
Features: ${spec.features.slice(0, 10).join(', ')}

Requirements Summary:
${this.truncate(requirements, 3000)}

Architecture:
${this.truncate(architecture, 3000)}

CRITICAL: Write EVERY line of code. No abbreviations. No "// ... rest of code". Include:
- All backend routes with full implementation
- Database schema/migrations/seeds
- Frontend pages with full UI code
- Authentication system
- Input validation and error handling
- package.json with all dependencies
- Environment config (.env.example)
- Docker setup (Dockerfile + docker-compose.yml)
- README with setup instructions`;
        },
      },
      {
        name: 'Database & API',
        agent: 'db-architect',
        icon: '\u{1F5C3}',
        description: 'Refining database schema and API design',
        maxTokens: 8192,
        buildQuery: (spec, prev) => {
          const architecture = prev.get('Architecture') || '';
          return `Review and enhance the database design for this application:

"${spec.description}"
Tech Stack: ${spec.techStack}

Architecture:
${this.truncate(architecture, 3000)}

Generate any missing database files:
1. Complete migration files (if not already generated)
2. Seed data with realistic sample data
3. Database utility/helper functions
4. Index optimization suggestions

For each file, use this format:
\`\`\`sql
// filepath: path/to/file.sql
[complete file content]
\`\`\`

Or for TypeScript/JavaScript:
\`\`\`typescript
// filepath: path/to/file.ts
[complete file content]
\`\`\``;
        },
      },
      {
        name: 'Tests',
        agent: 'test',
        icon: '\u{1F9EA}',
        description: 'Generating test suite',
        maxTokens: 8192,
        buildQuery: (spec, prev) => {
          const architecture = prev.get('Architecture') || '';
          return `Generate a comprehensive test suite for this application:

"${spec.description}"
Tech Stack: ${spec.techStack}

Architecture:
${this.truncate(architecture, 2000)}

Generate:
1. Unit tests for key business logic
2. API integration tests for main endpoints
3. Test utilities and fixtures

For each test file, use this format:
\`\`\`typescript
// filepath: tests/path/to/test.test.ts
[complete test file content]
\`\`\`

Include proper setup/teardown, realistic test data, and both happy path and error cases.`;
        },
      },
      {
        name: 'DevOps',
        agent: 'devops',
        icon: '\u{2699}',
        description: 'Setting up deployment and CI/CD',
        maxTokens: 8192,
        buildQuery: (spec, prev) => {
          const architecture = prev.get('Architecture') || '';
          return `Generate complete deployment configuration for this application:

"${spec.description}"
Tech Stack: ${spec.techStack}

Architecture:
${this.truncate(architecture, 2000)}

Generate these files (only if not already created in previous steps):
1. Dockerfile (multi-stage, production-optimized)
2. docker-compose.yml (app + database + redis if needed)
3. .github/workflows/ci.yml (build, test, lint)
4. .github/workflows/deploy.yml (deployment pipeline)
5. nginx.conf (if applicable)
6. .dockerignore

For each file, use this format:
\`\`\`yaml
// filepath: .github/workflows/ci.yml
[complete file content]
\`\`\``;
        },
      },
    ];
  }

  private truncate(text: string, maxChars: number): string {
    if (text.length <= maxChars) return text;
    return text.slice(0, maxChars) + '\n... [truncated for token efficiency]';
  }

  private extractJSON(raw: string): Record<string, unknown> | null {
    try {
      return JSON.parse(raw);
    } catch {
      // Try code block
      const match = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
      if (match) {
        try { return JSON.parse(match[1]); } catch { /* fall through */ }
      }
      // Try finding JSON object
      const objMatch = raw.match(/\{[\s\S]*\}/);
      if (objMatch) {
        try { return JSON.parse(objMatch[0]); } catch { /* fall through */ }
      }
      return null;
    }
  }

  private extractFilesFromCodeBlocks(raw: string): GeneratedFile[] {
    const files: GeneratedFile[] = [];
    // Match code blocks with filepath comments
    const pattern = /```[\w]*\s*\n\s*\/\/\s*(?:filepath|file|path):\s*(.+?)\n([\s\S]*?)```/g;
    let match;

    while ((match = pattern.exec(raw)) !== null) {
      const filePath = match[1].trim();
      const content = match[2].trim();
      if (filePath && content) {
        files.push({ path: filePath, content });
      }
    }

    return files;
  }

  private deduplicateFiles(files: GeneratedFile[]): GeneratedFile[] {
    const map = new Map<string, GeneratedFile>();
    for (const file of files) {
      map.set(file.path, file); // Later entries override earlier ones
    }
    return Array.from(map.values());
  }
}

import fs from 'node:fs';
import { BaseAgent } from '../base-agent.js';
import { getPerformanceSystemPrompt } from './prompt.js';
import type { AgentInput, ParsedResponse } from '../../types/agent.js';

const BUNDLE_CONFIG_PATTERNS = [
  'webpack.config.js', 'webpack.config.ts', 'webpack.config.mjs',
  'vite.config.js', 'vite.config.ts', 'vite.config.mjs',
  'rollup.config.js', 'rollup.config.ts',
];

const HEAVY_DEPS = ['moment', 'lodash', 'rxjs', 'three', 'pdf-lib', 'aws-sdk'];

export class PerformanceAgent extends BaseAgent {
  getSystemPrompt(): string {
    let prompt = getPerformanceSystemPrompt(this.projectInfo.framework || 'general');
    prompt = this.mergeUserRules(prompt);
    prompt += this.getFeedbackPrompt();
    prompt += `\n\n${this.getProjectContext()}`;
    return prompt;
  }

  protected preProcess(input: AgentInput): AgentInput {
    const hints: string[] = [];

    // Detect bundle config files
    for (const cfg of BUNDLE_CONFIG_PATTERNS) {
      if (fs.existsSync(cfg)) {
        hints.push(`Bundle config found: ${cfg}`);
      }
    }

    // Check for known heavy deps in package.json
    try {
      if (fs.existsSync('package.json')) {
        const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
        const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
        const found = HEAVY_DEPS.filter(d => d in allDeps);
        if (found.length > 0) {
          hints.push(`Heavy dependencies detected: ${found.join(', ')}`);
        }
      }
    } catch { /* skip */ }

    if (hints.length > 0) {
      return { ...input, context: `## Pre-scan Hints\n${hints.join('\n')}\n\n${input.context || ''}` };
    }
    return input;
  }

  buildPrompt(input: AgentInput): string {
    const parts: string[] = [];

    if (input.query) {
      parts.push(`## Question\n${input.query}\n`);
    } else {
      parts.push('Perform a performance audit on the following code.\n');
    }

    if (input.context) {
      parts.push(input.context);
    }

    return parts.join('\n\n');
  }

  parseResponse(raw: string): ParsedResponse {
    return this.parser.parseGeneral(raw);
  }
}

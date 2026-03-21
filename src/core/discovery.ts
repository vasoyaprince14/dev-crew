import readline from 'node:readline';
import chalk from 'chalk';
import { AgentRegistry } from '../agents/registry.js';
import { Spinner } from '../utils/spinner.js';
import type { ProjectInfo } from '../types/config.js';

export interface DiscoveryResult {
  refinedDescription: string;
  techStack: string;
  features: string[];
  answers: Record<string, string>;
}

const FALLBACK_QUESTIONS = [
  'What tech stack do you prefer? (e.g., Next.js + Postgres, React + Express + MongoDB, Python + FastAPI)',
  'What are the 3-5 must-have features for the first version?',
  'Do you need user authentication? (email/password, social login, phone OTP)',
  'Do you need payment processing? (Stripe, PayPal, etc.)',
  'Do you need real-time features? (chat, notifications, live updates)',
  'Any specific database preference? (PostgreSQL, MongoDB, MySQL)',
  'Should this be a web app, mobile app, or both?',
];

export class Discovery {
  private registry: AgentRegistry;
  private projectInfo: ProjectInfo;
  private spinner: Spinner;

  constructor(registry: AgentRegistry, projectInfo: ProjectInfo) {
    this.registry = registry;
    this.projectInfo = projectInfo;
    this.spinner = new Spinner();
  }

  async run(description: string, stackHint?: string): Promise<DiscoveryResult> {
    const answers: Record<string, string> = {};
    let questions = FALLBACK_QUESTIONS;

    // Try to get AI-generated questions
    try {
      this.spinner.start('  Analyzing your idea...');
      const baAgent = this.registry.create('ba', this.projectInfo);
      if (baAgent) {
        const result = await baAgent.execute({
          query: `You are scoping a new application. The user wants to build: "${description}".

Generate exactly 6 specific clarifying questions to understand scope, features, tech preferences, and constraints. Questions should be practical and help generate the best possible app.

Respond ONLY with JSON: { "questions": ["question1", "question2", ...] }`,
        });
        this.spinner.stop();

        const parsed = this.extractJSON(result.raw);
        if (parsed?.questions && Array.isArray(parsed.questions) && parsed.questions.length >= 3) {
          questions = parsed.questions;
        }
      } else {
        this.spinner.stop();
      }
    } catch {
      this.spinner.stop();
      // Fall through to fallback questions
    }

    // If stack was provided via CLI flag, skip the tech stack question
    if (stackHint) {
      questions = questions.filter(q => !q.toLowerCase().includes('tech stack') && !q.toLowerCase().includes('technology'));
      answers['tech_stack'] = stackHint;
    }

    // Interactive Q&A
    console.log();
    console.log(chalk.dim('  Answer these questions to build the best app for you:'));
    console.log(chalk.dim('  (press Enter to skip any question)'));
    console.log();

    const rl = this.createReadline();

    for (let i = 0; i < Math.min(questions.length, 7); i++) {
      const question = questions[i];
      const answer = await this.ask(rl, `  ${chalk.cyan(`${i + 1}.`)} ${question}\n  ${chalk.green('>')} `);

      if (answer.trim()) {
        answers[`q${i + 1}`] = answer.trim();
      }
    }

    rl.close();
    // Re-resume stdin — readline.close() can pause stdin which breaks subsequent
    // readline instances (they get an immediate 'close' event)
    if (process.stdin.isPaused()) {
      process.stdin.resume();
    }

    // Parse answers into structured result
    const features = this.extractFeatures(answers);
    const techStack = answers['tech_stack'] || this.extractTechStack(answers) || 'Node.js + React + PostgreSQL';

    // Build refined description
    const refinedParts = [description];
    for (const [key, value] of Object.entries(answers)) {
      if (key !== 'tech_stack') {
        refinedParts.push(value);
      }
    }

    return {
      refinedDescription: refinedParts.join('. '),
      techStack,
      features,
      answers,
    };
  }

  private createReadline(): readline.Interface {
    return readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  private ask(rl: readline.Interface, question: string): Promise<string> {
    return new Promise((resolve) => {
      rl.question(question, (answer) => resolve(answer));
      rl.on('close', () => resolve(''));
    });
  }

  private extractFeatures(answers: Record<string, string>): string[] {
    const features: string[] = [];
    for (const value of Object.values(answers)) {
      // Split on commas and common delimiters
      const parts = value.split(/[,;]+/).map(s => s.trim()).filter(Boolean);
      features.push(...parts);
    }
    return features;
  }

  private extractTechStack(answers: Record<string, string>): string | null {
    for (const value of Object.values(answers)) {
      const lower = value.toLowerCase();
      // Look for tech stack indicators
      if (lower.includes('next') || lower.includes('react') || lower.includes('express') ||
          lower.includes('django') || lower.includes('fastapi') || lower.includes('nest') ||
          lower.includes('postgres') || lower.includes('mongo') || lower.includes('mysql')) {
        return value;
      }
    }
    return null;
  }

  private extractJSON(raw: string): Record<string, unknown> | null {
    try {
      // Try raw parse first
      return JSON.parse(raw);
    } catch {
      // Try extracting from code block
      const match = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
      if (match) {
        try {
          return JSON.parse(match[1]);
        } catch { /* fall through */ }
      }
      // Try finding JSON object in text
      const objMatch = raw.match(/\{[\s\S]*\}/);
      if (objMatch) {
        try {
          return JSON.parse(objMatch[0]);
        } catch { /* fall through */ }
      }
      return null;
    }
  }
}

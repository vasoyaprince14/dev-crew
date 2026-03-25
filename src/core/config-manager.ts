import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import type { DevCrewConfig } from '../types/config.js';
import { InputSanitizer } from './input-sanitizer.js';
import { ConfigError } from '../utils/errors.js';

const PROJECT_CONFIG_DIR = '.dev-crew';
const PROJECT_CONFIG_FILE = 'config.yml';
const GLOBAL_CONFIG_DIR = '.dev-crew';
const GLOBAL_CONFIG_FILE = 'config.yml';

export class ConfigManager {
  private projectRoot: string;
  private config: DevCrewConfig | null = null;

  constructor(projectRoot?: string) {
    this.projectRoot = projectRoot || process.cwd();
  }

  get configDir(): string {
    return path.join(this.projectRoot, PROJECT_CONFIG_DIR);
  }

  get configPath(): string {
    return path.join(this.configDir, PROJECT_CONFIG_FILE);
  }

  get globalConfigPath(): string {
    const home = process.env.HOME || process.env.USERPROFILE || '';
    return path.join(home, GLOBAL_CONFIG_DIR, GLOBAL_CONFIG_FILE);
  }

  isInitialized(): boolean {
    return fs.existsSync(this.configPath);
  }

  load(): DevCrewConfig {
    if (this.config) return this.config;

    let globalConfig: DevCrewConfig = {};
    let projectConfig: DevCrewConfig = {};

    // Load global config
    if (fs.existsSync(this.globalConfigPath)) {
      try {
        globalConfig = (yaml.load(fs.readFileSync(this.globalConfigPath, 'utf-8')) as DevCrewConfig) || {};
      } catch (err) {
        throw new ConfigError(`Invalid global config YAML: ${(err as Error).message}`, `Check ${this.globalConfigPath}`);
      }
    }

    // Load project config
    if (fs.existsSync(this.configPath)) {
      try {
        projectConfig = (yaml.load(fs.readFileSync(this.configPath, 'utf-8')) as DevCrewConfig) || {};
      } catch (err) {
        throw new ConfigError(`Invalid project config YAML: ${(err as Error).message}`, `Check ${this.configPath}`);
      }
    }

    // Merge: project overrides global
    this.config = this.merge(globalConfig, projectConfig);
    return this.config;
  }

  save(config: DevCrewConfig): void {
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
    }
    fs.writeFileSync(this.configPath, yaml.dump(config, { lineWidth: 120 }));
    this.config = config;
  }

  get<T>(key: string): T | undefined {
    const config = this.load();
    return key.split('.').reduce((obj: unknown, k: string) => {
      if (obj && typeof obj === 'object') {
        return (obj as Record<string, unknown>)[k];
      }
      return undefined;
    }, config) as T | undefined;
  }

  set(key: string, value: unknown): void {
    const config = this.load();
    const keys = key.split('.');
    let obj: Record<string, unknown> = config as Record<string, unknown>;

    for (let i = 0; i < keys.length - 1; i++) {
      if (!obj[keys[i]] || typeof obj[keys[i]] !== 'object') {
        obj[keys[i]] = {};
      }
      obj = obj[keys[i]] as Record<string, unknown>;
    }

    obj[keys[keys.length - 1]] = value;
    this.save(config);
  }

  getAgentConfig(agentName: string): Record<string, unknown> {
    const config = this.load();
    return (config.agents?.[agentName] as Record<string, unknown>) || {};
  }

  getFeedback(agentName: string): string[] {
    const config = this.load();
    return config.feedback?.[agentName] || [];
  }

  addFeedback(agentName: string, message: string): void {
    const config = this.load();
    message = InputSanitizer.sanitizeFeedback(message);
    if (!config.feedback) config.feedback = {};
    if (!config.feedback[agentName]) config.feedback[agentName] = [];
    if (!config.feedback[agentName].includes(message)) {
      config.feedback[agentName].push(message);
      // Keep only last 30 feedback items per agent to prevent bloat
      if (config.feedback[agentName].length > 30) {
        config.feedback[agentName] = config.feedback[agentName].slice(-30);
      }
    }
    this.save(config);
  }

  private merge(base: DevCrewConfig, override: DevCrewConfig): DevCrewConfig {
    return {
      project: { ...base.project, ...override.project },
      settings: { ...base.settings, ...override.settings },
      agents: { ...base.agents, ...override.agents },
      feedback: { ...base.feedback, ...override.feedback },
    };
  }
}

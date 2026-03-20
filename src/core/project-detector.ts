import fs from 'node:fs';
import path from 'node:path';
import type { ProjectInfo } from '../types/config.js';

export class ProjectDetector {
  async detect(rootDir: string = process.cwd()): Promise<ProjectInfo> {
    const info: ProjectInfo = {
      name: path.basename(rootDir),
      root: rootDir,
      language: 'unknown',
      framework: null,
      database: [],
      orm: null,
      testFramework: null,
      packageManager: 'npm',
      hasDocker: false,
      hasCI: false,
      ciPlatform: null,
      monorepo: false,
      structure: 'unknown',
      dependencies: {},
      devDependencies: {},
      scripts: {},
      files: [],
    };

    const pkgPath = path.join(rootDir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        info.name = pkg.name || info.name;
        info.dependencies = pkg.dependencies || {};
        info.devDependencies = pkg.devDependencies || {};
        info.scripts = pkg.scripts || {};
      } catch {
        // invalid package.json
      }
    }

    info.language = this.detectLanguage(rootDir);
    info.framework = this.detectFramework(info.dependencies, info.devDependencies);
    info.database = this.detectDatabase(info.dependencies);
    info.orm = this.detectORM(info.dependencies);
    info.testFramework = this.detectTestFramework(info.dependencies, info.devDependencies);
    info.packageManager = this.detectPackageManager(rootDir);
    info.hasDocker =
      fs.existsSync(path.join(rootDir, 'Dockerfile')) ||
      fs.existsSync(path.join(rootDir, 'docker-compose.yml')) ||
      fs.existsSync(path.join(rootDir, 'docker-compose.yaml'));
    info.hasCI = fs.existsSync(path.join(rootDir, '.github/workflows'));
    info.ciPlatform = this.detectCI(rootDir);
    info.monorepo =
      fs.existsSync(path.join(rootDir, 'lerna.json')) ||
      fs.existsSync(path.join(rootDir, 'pnpm-workspace.yaml')) ||
      fs.existsSync(path.join(rootDir, 'turbo.json'));
    info.structure = this.detectStructure(rootDir);

    try {
      info.files = fs.readdirSync(rootDir).filter(f => !f.startsWith('.'));
    } catch {
      info.files = [];
    }

    return info;
  }

  private detectLanguage(root: string): ProjectInfo['language'] {
    if (fs.existsSync(path.join(root, 'tsconfig.json'))) return 'typescript';
    if (fs.existsSync(path.join(root, 'package.json'))) return 'javascript';
    if (fs.existsSync(path.join(root, 'requirements.txt')) || fs.existsSync(path.join(root, 'pyproject.toml'))) return 'python';
    if (fs.existsSync(path.join(root, 'go.mod'))) return 'go';
    if (fs.existsSync(path.join(root, 'Cargo.toml'))) return 'rust';
    if (fs.existsSync(path.join(root, 'pom.xml')) || fs.existsSync(path.join(root, 'build.gradle'))) return 'java';
    return 'unknown';
  }

  private detectFramework(deps: Record<string, string>, devDeps: Record<string, string>): string | null {
    const all = { ...deps, ...devDeps };
    if (all['@nestjs/core']) return 'nestjs';
    if (all['next']) return 'nextjs';
    if (all['nuxt']) return 'nuxt';
    if (all['express']) return 'express';
    if (all['fastify']) return 'fastify';
    if (all['koa']) return 'koa';
    if (all['hono']) return 'hono';
    if (all['@angular/core']) return 'angular';
    if (all['react'] && !all['next']) return 'react';
    if (all['vue'] && !all['nuxt']) return 'vue';
    if (all['svelte']) return 'svelte';
    if (all['astro']) return 'astro';
    return null;
  }

  private detectDatabase(deps: Record<string, string>): string[] {
    const dbs: string[] = [];
    if (deps['pg'] || deps['postgres'] || deps['@neondatabase/serverless']) dbs.push('postgresql');
    if (deps['mysql2'] || deps['mysql']) dbs.push('mysql');
    if (deps['mongodb'] || deps['mongoose']) dbs.push('mongodb');
    if (deps['redis'] || deps['ioredis']) dbs.push('redis');
    if (deps['sqlite3'] || deps['better-sqlite3']) dbs.push('sqlite');
    return dbs;
  }

  private detectORM(deps: Record<string, string>): string | null {
    if (deps['@prisma/client']) return 'prisma';
    if (deps['typeorm']) return 'typeorm';
    if (deps['sequelize']) return 'sequelize';
    if (deps['drizzle-orm']) return 'drizzle';
    if (deps['knex']) return 'knex';
    if (deps['mongoose']) return 'mongoose';
    return null;
  }

  private detectTestFramework(deps: Record<string, string>, devDeps: Record<string, string>): string | null {
    const all = { ...deps, ...devDeps };
    if (all['vitest']) return 'vitest';
    if (all['jest']) return 'jest';
    if (all['mocha']) return 'mocha';
    if (all['ava']) return 'ava';
    if (all['pytest']) return 'pytest';
    return null;
  }

  private detectPackageManager(root: string): string {
    if (fs.existsSync(path.join(root, 'pnpm-lock.yaml'))) return 'pnpm';
    if (fs.existsSync(path.join(root, 'yarn.lock'))) return 'yarn';
    if (fs.existsSync(path.join(root, 'bun.lockb'))) return 'bun';
    return 'npm';
  }

  private detectCI(root: string): string | null {
    if (fs.existsSync(path.join(root, '.github/workflows'))) return 'github-actions';
    if (fs.existsSync(path.join(root, '.gitlab-ci.yml'))) return 'gitlab-ci';
    if (fs.existsSync(path.join(root, 'Jenkinsfile'))) return 'jenkins';
    if (fs.existsSync(path.join(root, '.circleci'))) return 'circleci';
    return null;
  }

  private detectStructure(root: string): ProjectInfo['structure'] {
    const srcDir = path.join(root, 'src');
    if (!fs.existsSync(srcDir)) return 'flat';

    let dirs: string[];
    try {
      dirs = fs
        .readdirSync(srcDir, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name);
    } catch {
      return 'unknown';
    }

    if (dirs.some(d => d.includes('module'))) return 'modular';
    if (dirs.includes('controllers') && dirs.includes('services')) return 'layered';

    return 'unknown';
  }
}

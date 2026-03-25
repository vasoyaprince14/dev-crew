import fs from 'node:fs';
import path from 'node:path';
import type { ProjectInfo } from '../types/config.js';

const CACHE_DIR = '.dev-crew';
const CACHE_FILE = '.project-cache.json';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry {
  info: ProjectInfo;
  timestamp: number;
  packageJsonMtime: number;
}

/**
 * Caches project detection results so we don't re-scan the filesystem
 * on every single command. Invalidates when package.json changes.
 */
export class ProjectCache {
  private cachePath: string;

  constructor(root: string = process.cwd()) {
    this.cachePath = path.join(root, CACHE_DIR, CACHE_FILE);
  }

  get(): ProjectInfo | null {
    try {
      if (!fs.existsSync(this.cachePath)) return null;
      const entry: CacheEntry = JSON.parse(fs.readFileSync(this.cachePath, 'utf-8'));

      // Check TTL
      if (Date.now() - entry.timestamp > CACHE_TTL_MS) return null;

      // Check if package.json changed
      const pkgPath = path.join(process.cwd(), 'package.json');
      if (fs.existsSync(pkgPath)) {
        const mtime = fs.statSync(pkgPath).mtimeMs;
        if (mtime !== entry.packageJsonMtime) return null;
      }

      return entry.info;
    } catch {
      return null;
    }
  }

  set(info: ProjectInfo): void {
    try {
      const dir = path.dirname(this.cachePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      let packageJsonMtime = 0;
      const pkgPath = path.join(process.cwd(), 'package.json');
      if (fs.existsSync(pkgPath)) {
        packageJsonMtime = fs.statSync(pkgPath).mtimeMs;
      }

      const entry: CacheEntry = { info, timestamp: Date.now(), packageJsonMtime };
      fs.writeFileSync(this.cachePath, JSON.stringify(entry));
    } catch { /* non-critical */ }
  }
}

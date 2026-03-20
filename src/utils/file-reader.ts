import fs from 'node:fs';
import path from 'node:path';

const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.svg',
  '.woff', '.woff2', '.ttf', '.eot',
  '.zip', '.tar', '.gz', '.br',
  '.pdf', '.doc', '.docx',
  '.mp3', '.mp4', '.avi', '.mov',
  '.exe', '.dll', '.so', '.dylib',
  '.lock',
]);

const INCLUDE_EXTENSIONS = new Set([
  '.ts', '.js', '.tsx', '.jsx', '.json', '.prisma', '.graphql',
  '.sql', '.yml', '.yaml', '.toml', '.env', '.md', '.txt',
  '.py', '.go', '.rs', '.java', '.kt', '.swift', '.rb',
  '.sh', '.bash', '.zsh', '.fish',
  '.css', '.scss', '.less', '.html',
  '.xml', '.proto', '.tf', '.hcl',
]);

const EXCLUDE_DIRS = new Set([
  'node_modules', 'dist', 'build', '.git', 'coverage',
  '.next', '.nuxt', '__pycache__', '.pytest_cache',
  'vendor', 'target', '.turbo', '.cache',
]);

export function isBinaryFile(filePath: string): boolean {
  return BINARY_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

export function shouldIncludeFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '') return false;
  if (BINARY_EXTENSIONS.has(ext)) return false;
  return INCLUDE_EXTENSIONS.has(ext);
}

export function shouldExcludeDir(dirName: string): boolean {
  return EXCLUDE_DIRS.has(dirName) || dirName.startsWith('.');
}

export function readFileSafe(filePath: string): string | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    if (isBinaryFile(filePath)) return null;
    const stat = fs.statSync(filePath);
    if (stat.size > 500_000) return null; // skip files > 500KB
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

export function walkDir(dir: string, maxDepth: number, currentDepth = 0): string[] {
  if (currentDepth >= maxDepth) return [];

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const files: string[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith('.') && entry.isDirectory()) continue;
    if (shouldExcludeDir(entry.name) && entry.isDirectory()) continue;

    const fullPath = path.join(dir, entry.name);

    if (entry.isFile() && shouldIncludeFile(fullPath)) {
      files.push(fullPath);
    } else if (entry.isDirectory()) {
      files.push(...walkDir(fullPath, maxDepth, currentDepth + 1));
    }
  }

  return files;
}

export function getExtensionLabel(filePath: string): string {
  const ext = path.extname(filePath).slice(1);
  const map: Record<string, string> = {
    ts: 'typescript', js: 'javascript', tsx: 'typescript', jsx: 'javascript',
    prisma: 'prisma', yml: 'yaml', yaml: 'yaml', py: 'python',
    go: 'go', rs: 'rust', java: 'java', sql: 'sql', graphql: 'graphql',
    sh: 'bash', json: 'json', md: 'markdown',
  };
  return map[ext] || ext;
}

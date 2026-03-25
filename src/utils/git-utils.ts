import { simpleGit, type SimpleGit } from 'simple-git';

let gitInstance: SimpleGit | null = null;

export function getGit(cwd?: string): SimpleGit {
  if (!gitInstance) {
    gitInstance = simpleGit(cwd || process.cwd());
  }
  return gitInstance;
}

export async function isGitRepo(cwd?: string): Promise<boolean> {
  try {
    const git = simpleGit(cwd || process.cwd());
    await git.status();
    return true;
  } catch {
    return false;
  }
}

export async function getCurrentBranch(): Promise<string> {
  const git = getGit();
  const status = await git.status();
  return status.current || 'unknown';
}

export async function getStagedDiff(): Promise<string> {
  const git = getGit();
  return git.diff(['--cached']);
}

export async function getBranchDiff(branch?: string): Promise<string> {
  const git = getGit();
  const base = branch || 'main';
  try {
    return await git.diff([`${base}...HEAD`]);
  } catch {
    try {
      return await git.diff([`master...HEAD`]);
    } catch {
      return await git.diff(['HEAD~1']);
    }
  }
}

export async function getChangedFiles(branch?: string): Promise<string[]> {
  const git = getGit();
  const base = branch || 'main';
  try {
    const diff = await git.diffSummary([`${base}...HEAD`]);
    return diff.files.map(f => f.file);
  } catch {
    const diff = await git.diffSummary(['HEAD~1']);
    return diff.files.map(f => f.file);
  }
}

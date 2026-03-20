import type { TokenReport } from '../types/response.js';

export class TokenOptimizer {
  private readonly CHARS_PER_TOKEN = 4;

  estimate(text: string): number {
    return Math.ceil(text.length / this.CHARS_PER_TOKEN);
  }

  compress(content: string): string {
    let result = content;

    // Remove excessive blank lines (keep max 1)
    result = result.replace(/\n{3,}/g, '\n\n');

    // Remove trailing whitespace per line
    result = result.replace(/[ \t]+$/gm, '');

    return result;
  }

  selectRelevantFiles(
    files: string[],
    targetFile: string,
    maxTokens: number,
    estimateFileFn?: (file: string) => number,
  ): string[] {
    const estimateFn = estimateFileFn || (() => 500);
    const prioritized: string[] = [targetFile];
    let currentTokens = estimateFn(targetFile);

    for (const file of files) {
      if (file === targetFile) continue;
      const fileTokens = estimateFn(file);
      if (currentTokens + fileTokens > maxTokens) break;
      prioritized.push(file);
      currentTokens += fileTokens;
    }

    return prioritized;
  }

  report(prompt: string, response: string): TokenReport {
    const promptTokens = this.estimate(prompt);
    const responseTokens = this.estimate(response);
    return {
      prompt: promptTokens,
      response: responseTokens,
      total: promptTokens + responseTokens,
      cost: this.estimateCost(promptTokens, responseTokens),
    };
  }

  private estimateCost(promptTokens: number, responseTokens: number): number {
    // Rough estimate based on AI model pricing
    return (promptTokens * 0.003 + responseTokens * 0.015) / 1000;
  }
}

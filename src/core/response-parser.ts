import type { ParsedResponse, Issue, Fix, FileDiff } from '../types/agent.js';

export class ResponseParser {
  parseReview(raw: string): ParsedResponse {
    // Try JSON first
    try {
      const json = this.extractJSON(raw);
      if (json && (json.issues || json.summary)) {
        return {
          type: 'review',
          summary: json.summary || 'Review complete',
          score: json.score,
          issues: (json.issues || []).map(this.normalizeIssue),
          suggestions: json.suggestions || [],
          positives: json.positives || [],
          raw,
        };
      }
    } catch {
      // fallback to text parsing
    }

    return {
      type: 'review',
      summary: this.extractSummary(raw),
      issues: this.extractIssuesFromText(raw),
      suggestions: this.extractSuggestions(raw),
      raw,
    };
  }

  parseFix(raw: string): ParsedResponse {
    try {
      const json = this.extractJSON(raw);
      if (json) {
        return {
          type: 'fix',
          summary: json.analysis || json.summary || 'Fix generated',
          fixes: json.fix ? [json.fix] : json.fixes || [],
          diffs: this.extractDiffs(raw),
          raw,
        };
      }
    } catch {
      // fallback
    }

    return {
      type: 'fix',
      summary: this.extractSummary(raw),
      diffs: this.extractDiffs(raw),
      raw,
    };
  }

  parseDebug(raw: string): ParsedResponse {
    try {
      const json = this.extractJSON(raw);
      if (json) {
        return {
          type: 'debug',
          summary: json.summary || 'Debug analysis complete',
          rootCause: json.root_cause?.description || json.rootCause || '',
          fixes: json.fix ? [json.fix] : json.fixes || [],
          raw,
        };
      }
    } catch {
      // fallback
    }

    return {
      type: 'debug',
      summary: this.extractSummary(raw),
      rootCause: this.extractRootCause(raw),
      raw,
    };
  }

  parseTest(raw: string): ParsedResponse {
    return {
      type: 'test',
      summary: 'Test file generated',
      raw,
    };
  }

  parseGeneral(raw: string): ParsedResponse {
    try {
      const json = this.extractJSON(raw);
      if (json) {
        return {
          type: 'general',
          summary: json.summary || json.assessment || 'Analysis complete',
          suggestions: json.suggestions || json.recommendations || [],
          raw,
        };
      }
    } catch {
      // fallback
    }

    return {
      type: 'general',
      summary: this.extractSummary(raw),
      raw,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private extractJSON(text: string): any | null {
    // Try JSON block in markdown
    const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1]);
    }

    // Try raw JSON
    const trimmed = text.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      return JSON.parse(trimmed);
    }

    // Try to find JSON embedded in text
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        // not valid JSON
      }
    }

    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private normalizeIssue(issue: any): Issue {
    return {
      severity: (issue.severity as Issue['severity']) || 'info',
      file: (issue.file as string) || 'unknown',
      line: issue.line as number | undefined,
      title: issue.title as string | undefined,
      message: (issue.message as string) || (issue.description as string) || '',
      suggestion: (issue.suggestion as string) || (issue.fix as string) || undefined,
    };
  }

  private extractSummary(text: string): string {
    const lines = text.split('\n').filter(l => l.trim());
    return lines[0]?.slice(0, 200) || 'Analysis complete';
  }

  private extractIssuesFromText(text: string): Issue[] {
    const issues: Issue[] = [];
    const lines = text.split('\n');

    for (const line of lines) {
      const match = line.match(/\[(critical|warning|info|CRITICAL|WARNING|INFO)\]\s*(\S+?)(?::(\d+))?\s*[-—]\s*(.*)/i);
      if (match) {
        issues.push({
          severity: match[1].toLowerCase() as Issue['severity'],
          file: match[2],
          line: match[3] ? parseInt(match[3]) : undefined,
          message: match[4],
        });
      }
    }

    return issues;
  }

  private extractSuggestions(text: string): string[] {
    const suggestions: string[] = [];
    const lines = text.split('\n');

    for (const line of lines) {
      if (line.match(/^[\s]*[-*•]\s*(suggest|recommend)/i)) {
        suggestions.push(line.replace(/^[\s]*[-*•]\s*/, ''));
      }
    }

    return suggestions;
  }

  private extractDiffs(text: string): FileDiff[] {
    const diffs: FileDiff[] = [];
    const diffRegex = /```diff\n([\s\S]*?)\n```/g;
    let match;

    while ((match = diffRegex.exec(text)) !== null) {
      const diffText = match[1];
      const fileMatch = diffText.match(/[-+]{3}\s+[ab]\/(.*)/);
      if (fileMatch) {
        diffs.push({
          file: fileMatch[1],
          hunks: [],
        });
      }
    }

    return diffs;
  }

  private extractRootCause(text: string): string {
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes('root cause')) {
        return lines.slice(i, i + 5).join('\n');
      }
    }
    return '';
  }
}

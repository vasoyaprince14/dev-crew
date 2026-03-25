export class InputSanitizer {
  private static readonly INJECTION_PATTERNS = [
    /ignore\s+(all\s+)?previous\s+instructions/i,
    /you\s+are\s+now/i,
    /act\s+as/i,
    /your\s+new\s+role/i,
    /system\s*:/i,
    /<\|system\|>/i,
    /<system>/i,
    /```\s*(system|role|instruction)/i,
  ];
  private static readonly MAX_LENGTH = 500;

  static sanitizeFeedback(input: string): string {
    let sanitized = input.slice(0, InputSanitizer.MAX_LENGTH);
    for (const pattern of InputSanitizer.INJECTION_PATTERNS) {
      sanitized = sanitized.replace(pattern, '[removed]');
    }
    return sanitized;
  }

  static sanitizeRules(rules: string[]): string[] {
    return rules.map(r => InputSanitizer.sanitizeFeedback(r));
  }
}

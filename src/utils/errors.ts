export class DevCrewError extends Error {
  constructor(message: string, public code: string, public hint?: string) {
    super(message);
    this.name = 'DevCrewError';
  }
}

export class ProviderError extends DevCrewError {
  constructor(message: string, hint?: string) {
    super(message, 'PROVIDER_ERROR', hint);
    this.name = 'ProviderError';
  }
}

export class ConfigError extends DevCrewError {
  constructor(message: string, hint?: string) {
    super(message, 'CONFIG_ERROR', hint);
    this.name = 'ConfigError';
  }
}

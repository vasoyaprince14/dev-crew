# Changelog

All notable changes to Dev-Crew are documented here.

## [2.3.2] - 2026-03-21

### Fixed
- Claude Code CLI is now the default provider (priority 1) — no extra setup needed
- `@anthropic-ai/sdk` moved to optionalDependencies — not required to install
- Bundle size back to 141KB (was 222KB when SDK was bundled)
- Graceful fallback when SDK is not installed

## [2.3.0] - 2026-03-21

### Added
- Direct Claude API integration via `@anthropic-ai/sdk`
- Real token-by-token streaming from Claude API
- Exact token counts from API response
- `ANTHROPIC_MODEL` env var to choose Claude model
- Helpful error messages for API errors (401, 429, 529)

## [2.2.0] - 2026-03-21

### Added
- CI pipeline (GitHub Actions — build + test on Node 18/20/22)
- 90 npm keywords for better discoverability
- Complete README rewrite with guide, troubleshooting, examples
- Support for 15+ more file extensions (C, C++, Vue, Svelte, etc.)

### Fixed
- ANSI colors disabled for non-TTY output (piping to file works)
- Spinner/streaming catches stdout errors
- Process kill on timeout (SIGTERM + SIGKILL — no zombie processes)
- Ctrl+C twice to exit (single cancels current operation)
- Cursor always restored on exit/crash
- Multi-line trailing space edge case
- Global uncaughtException/unhandledRejection handlers
- Cross-platform temp directory (os.tmpdir vs /tmp)
- Git repo check before git apply
- File permissions preserved on fix
- Timestamped backups (no overwrites)
- Config feedback capped at 30 items per agent

## [2.1.0] - 2026-03-21

### Changed
- Complete CLI rewrite — clean chat-like UX (1350 → 340 lines)
- Streaming responses by default
- Minimal response footer: `agent · tokens · time`
- Welcome screen: 4 lines (name, version, project, provider)

### Added
- Tab completion for @files, /commands, agent names
- Multi-line input with `\` continuation
- `/export` command to save responses
- `/tokens` session stats

## [2.0.0] - 2026-03-21

### Changed
- Major performance overhaul — 60%+ token reduction
- Selective feature activation (git intel, schema, config per agent)
- Context limits reduced: 50K→30K chars, 10→8 files, 8K→6K per file
- Real comment stripping for JS/TS/Python (10-30% savings)
- maxTokens reduced from 8192 to 4096

### Removed
- Import resolution (too many tokens for marginal benefit)
- Pattern injection from system prompts
- Bloated token reports

## [1.3.0] - 2026-03-21

### Added
- Interactive mode with full REPL
- Natural language routing to agents
- File picker and @file syntax

## [1.2.0] - 2026-03-21

### Fixed
- Token metrics use real numbers (removed fake 2.5x multiplier)
- Honest token reporting

## [1.1.0] - 2026-03-21

### Added
- Terminal UI with spinners, colors, score bars
- npm download stats command

## [1.0.0] - 2026-03-21

### Added
- Initial release
- 24 specialized AI agents
- Multi-provider support (Claude Code, Aider, Copilot, OpenAI, Ollama)
- Smart context engine with project auto-detection
- Feedback system
- Simulation mode

# Changelog

All notable changes to Dev-Crew are documented here.

## [4.0.0] - 2026-03-21

### Added — "Startup in a CLI"
- **15 new agents** (40 total) — complete startup launch toolkit:
  - `solution-architect` — Recommends optimal tech stack based on requirements
  - `db-builder` — Generates complete database schemas, migrations, seed data
  - `db-analytics` — Query performance analysis, slow query detection, index optimization
  - `ui-designer` — Design systems, component libraries, page layouts
  - `ui-analytics` — Frontend performance, bundle analysis, Core Web Vitals
  - `seo` — SEO audit, meta tags, structured data, sitemap generation
  - `landing-page` — Conversion-optimized landing page generation
  - `auth-architect` — Complete auth system design (JWT, OAuth, MFA, RBAC)
  - `payment` — Stripe/PayPal integration, subscriptions, billing
  - `launch` — Production launch checklist, go-live readiness audit
  - `pitch` — Pitch decks, investor materials, market sizing
  - `email-builder` — Email templates, transactional emails, delivery setup
  - `marketing` — Go-to-market strategy, content plans, growth campaigns
  - `product-analyst` — Product metrics, feature prioritization, roadmap
  - `growth` — CEO/COO/CRO strategy, operations, revenue optimization
- **Solution Architect in create pipeline** — now recommends tech stack before building
- **"Built with Dev-Crew" badge** — auto-added to generated projects' README
- **User feedback system** — rates experience after `dev-crew create`, stored locally
- **`dev-crew showcase`** — view your projects built with Dev-Crew and community info
- **Generic agent command factory** — `makeAgentCommand()` for consistent agent CLI pattern
- 14 new npm keywords for startup/business discoverability

### Fixed
- Discovery readline closing stdin, breaking subsequent confirm prompts

## [3.0.0] - 2026-03-21

### Added
- **`dev-crew create` — Build complete apps from a single prompt**
  - Interactive discovery phase: AI asks clarifying questions about your app
  - 6-stage pipeline: Requirements → Architecture → Code Generation → Database → Tests → DevOps
  - Generates complete, runnable code — every file written in full
  - Writes all files to disk with directory creation
  - Auto-runs `npm install` and `git init` after generation
  - Supports `--stack`, `--output`, `--yes`, `--no-install` options
- New `app-creator` agent (25th agent) — specialized for complete app generation with 16K token output
- `CreatePipeline` orchestrator — chains 6 agents sequentially, each feeding context to the next
- `Discovery` module — AI-powered Q&A to understand user requirements before building
- `FileWriter` utility — safe file writing with directory traversal protection
- NLP routing: "build me an app", "create app", "vibe coding" routes to app-creator

### Changed
- Now 25 agents (was 24)
- Package description updated to highlight app builder capability
- Added 8 new npm keywords: app-builder, vibe-coding, startup-builder, etc.

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

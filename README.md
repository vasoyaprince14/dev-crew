<p align="center">
  <img src="https://img.shields.io/npm/v/dev-crew?color=brightgreen&style=for-the-badge" alt="npm version" />
  <img src="https://img.shields.io/npm/dm/dev-crew?color=blue&style=for-the-badge" alt="monthly downloads" />
  <img src="https://img.shields.io/npm/dt/dev-crew?color=purple&style=for-the-badge" alt="total downloads" />
  <img src="https://img.shields.io/github/stars/vasoyaprince14/dev-crew?style=for-the-badge&color=yellow" alt="GitHub stars" />
  <img src="https://img.shields.io/github/license/vasoyaprince14/dev-crew?style=for-the-badge" alt="license" />
  <img src="https://img.shields.io/node/v/dev-crew?style=for-the-badge" alt="node version" />
</p>

<h1 align="center">Dev-Crew</h1>

<p align="center">
  <strong>24 AI Agents for Code Review, Testing, Security, DevOps & More — One CLI</strong><br/>
  <sub>Works with Claude Code, OpenAI, GitHub Copilot, Aider, Ollama. Zero config. Free & open source.</sub>
</p>

<p align="center">
  <a href="#-quick-start">Quick Start</a> &bull;
  <a href="#-all-24-agents">All Agents</a> &bull;
  <a href="#-interactive-mode">Interactive Mode</a> &bull;
  <a href="#-complete-guide">Guide</a> &bull;
  <a href="#-multi-provider-support">Providers</a> &bull;
  <a href="#-configuration">Config</a>
</p>

---

## What is Dev-Crew?

Dev-Crew is a **free, open-source CLI** that gives you an entire AI development team from your terminal. Instead of one generic AI assistant, you get **24 specialized agents** — each an expert in their domain.

```bash
npm install -g dev-crew
dev-crew
```

That's it. Dev-Crew auto-detects your project stack and picks the best available AI provider. No API keys needed — simulation mode works out of the box.

```
  Dev-Crew v2.2.0

  my-app (typescript/nestjs)  on main
  Claude Code · 24 agents · /help for commands

❯ review @src/controllers/auth.ts
  ⠹ Checking git history... 4s
```

---

## Why Dev-Crew Over Other AI Tools?

| Problem | Dev-Crew's Answer |
|---|---|
| Generic AI gives surface-level reviews | **24 domain-expert agents** — security agent knows OWASP, DevOps agent knows Kubernetes |
| Need to copy-paste code into ChatGPT | **Auto-detects** your framework, DB, ORM and builds context automatically |
| Locked to one AI provider | **5 providers** — Claude, OpenAI, Copilot, Aider, Ollama + simulation fallback |
| AI doesn't know your codebase | **Smart context engine** gathers files, schemas, configs, git history |
| Expensive token usage | **Comment stripping + compression** reduces tokens by 10-30% |
| Can't try without API keys | **Simulation mode** — works instantly, no setup needed |
| AI forgets your preferences | **Feedback system** — teach agents your rules, they remember across sessions |
| Want to use in CI/CD | **CI mode** — `dev-crew review src/ --ci` returns exit code 2 on critical issues |

---

## 🚀 Quick Start

### Install

```bash
# Install globally (recommended)
npm install -g dev-crew

# Or use npx (no install)
npx dev-crew

# Or install from source
git clone https://github.com/vasoyaprince14/dev-crew.git
cd dev-crew && npm install && npm run build && npm link
```

### Requirements

- **Node.js** 18 or higher
- **AI provider** (optional) — any one of: Claude Code, Aider, GitHub Copilot, OpenAI CLI, or Ollama
- Works **without any AI installed** using simulation mode

### First Run

```bash
# Start interactive mode (default)
dev-crew

# Or initialize in your project
dev-crew init

# Check everything works
dev-crew doctor
```

### Your First Commands

```bash
# Review code
dev-crew review src/

# Fix a bug
dev-crew fix src/api/handler.ts --issue "null reference on line 42"

# Generate tests
dev-crew test src/services/auth.ts

# Security audit
dev-crew security src/

# Ask anything
dev-crew ask "how does authentication work in this project?"
```

---

## 🤖 All 24 Agents

### Core Agents

| Agent | Command | What It Does |
|---|---|---|
| **Reviewer** | `review [path]` | Deep code review — knows your framework, DB, patterns |
| **Fixer** | `fix <file>` | Suggests fixes with diffs, can auto-apply |
| **Debugger** | `debug <input>` | Root cause analysis from logs, errors, stack traces |
| **Tester** | `test <file>` | Generates unit/integration/e2e tests for your test runner |
| **Q&A** | `ask <question>` | Ask anything about your codebase |
| **Explainer** | `explain <file>` | Detailed walkthrough of how code works |

### Architecture & Leadership

| Agent | Command | What It Does |
|---|---|---|
| **Tech Lead** | `tech-lead [question]` | Architecture decisions with trade-off analysis |
| **Business Analyst** | `ba <requirement>` | Turns requirements into technical specs |
| **CTO** | `cto review` | Strategic review across 7 dimensions |
| **PR Reviewer** | `pr review` | Full pull request review with git diff analysis |
| **Security** | `security [path]` | OWASP Top 10 audit with fix guidance |
| **Designer** | `designer api\|schema` | API and schema design review |

### DevOps & Infrastructure

| Agent | Command | What It Does |
|---|---|---|
| **DevOps** | `devops [question]` | Docker, CI/CD, Terraform, Kubernetes help |
| **Cost Optimizer** | `cost-optimizer` | Cloud cost analysis for AWS/GCP/Azure/Vercel |
| **Monitoring** | `monitoring` | Observability, alerting, and logging strategy |
| **Deploy** | `deploy` | Complete deployment strategy for your stack |

### Full-Stack & Database

| Agent | Command | What It Does |
|---|---|---|
| **Scaffold** | `scaffold <desc>` | Generate entire project structures |
| **DB Architect** | `db-architect` | Schema design, query optimization, indexing |
| **API Architect** | `api-architect` | REST/GraphQL design, versioning, rate limiting |

### Mobile Development

| Agent | Command | What It Does |
|---|---|---|
| **Flutter** | `flutter [input]` | Dart/Flutter review and best practices |
| **React Native** | `react-native [input]` | RN performance, navigation, native modules |
| **iOS** | `ios [input]` | Swift/SwiftUI, memory management, App Store guidelines |
| **Android** | `android [input]` | Kotlin/Jetpack Compose, lifecycle, Play Store compliance |

### Quality & Performance

| Agent | Command | What It Does |
|---|---|---|
| **Performance** | `performance [path]` | Frontend + backend performance audit |
| **Accessibility** | `accessibility [path]` | WCAG 2.1 AA compliance audit |

---

## 💬 Interactive Mode

The fastest way to use Dev-Crew. Just type naturally:

```bash
dev-crew         # starts interactive mode
dev-crew i       # shorthand
```

```
❯ review @src/controllers/auth.ts
  ████████░░ 8/10
  ● Missing rate limiting on login endpoint
    → Add express-rate-limit middleware
  ✓ Good JWT token validation
  ✓ Password hashing with bcrypt
  review · 2,341 tokens · 3.2s

❯ fix the authentication bug in @src/auth.ts
❯ write tests for the user service
❯ is there any security issue in the API?
❯ explain how the middleware chain works
❯ how much would it cost to deploy on AWS?
```

### Slash Commands

| Command | Description |
|---|---|
| `/help` | Show all commands and usage examples |
| `/agents` | List all 24 agents with descriptions |
| `/clear` | Clear screen |
| `/diff` | Show recent git changes |
| `/provider <name>` | Switch AI provider |
| `/project` | Show detected project info |
| `/doctor` | Check setup and providers |
| `/tokens` | Session token usage stats |
| `/feedback <agent> <msg>` | Teach an agent your preferences |
| `/export [file]` | Save last response to file |
| `/quit` | Exit (or Ctrl+C twice) |

### Tips

- Use `@path/to/file` to include files in your query
- Use `\` at end of line for multi-line input
- Tab completion works for file paths, agents, and slash commands
- Ctrl+C cancels the current operation
- Ctrl+C twice exits Dev-Crew

---

## 📖 Complete Guide

### Code Review

```bash
# Basic review
dev-crew review src/

# Quick review (less detail, faster)
dev-crew review src/ --depth quick

# Deep review with explanations
dev-crew review src/controllers/ --depth deep --explain

# Review with git history analysis
dev-crew review src/api/ --git-aware

# CI mode (JSON output, exit code 2 on critical issues)
dev-crew review src/ --ci
```

### Fixing Code

```bash
# Auto-detect issues and suggest fixes
dev-crew fix src/services/user.ts

# Fix a specific issue
dev-crew fix src/api/handler.ts --issue "handle null response from API"

# Show diff without applying
dev-crew fix src/utils/parser.ts --dry-run

# Auto-apply without confirmation
dev-crew fix src/config.ts --auto-apply
```

### Testing

```bash
# Generate unit tests
dev-crew test src/services/auth.ts

# Integration tests
dev-crew test src/api/ --type integration

# E2E tests
dev-crew test src/routes/ --type e2e
```

### Security Auditing

```bash
# Full security audit
dev-crew security src/

# In interactive mode
❯ check if there are any SQL injection vulnerabilities
❯ review @src/api/auth.ts for security issues
```

### DevOps & Deployment

```bash
# Docker and CI/CD guidance
dev-crew devops "how to set up GitHub Actions for this project"

# Deployment strategy
dev-crew deploy "deploy to AWS with auto-scaling"

# Cost analysis
dev-crew cost-optimizer "compare AWS vs GCP for our stack"

# Monitoring setup
dev-crew monitoring "set up alerting for API latency"
```

### Database & API Design

```bash
# Schema review
dev-crew db-architect "review our user schema for performance"

# API design
dev-crew api-architect "design REST endpoints for user management"
```

### Mobile Development

```bash
# Flutter
dev-crew flutter "review state management in @lib/providers/"

# React Native
dev-crew react-native "optimize list rendering performance"

# iOS
dev-crew ios "review memory management in @Sources/Networking/"

# Android
dev-crew android "check Jetpack Compose performance"
```

### Multi-Agent Workflows

```bash
# Full feature pipeline: BA → Tech Lead → Security → Tests → Review
dev-crew feature "Add JWT authentication with refresh tokens"

# Prioritized refactoring plan
dev-crew refactor-plan src/

# Change impact analysis
dev-crew impact src/core/auth.ts
```

### Teaching Agents Your Preferences

```bash
# In CLI
dev-crew feedback review "Always flag console.log in production code"
dev-crew feedback security "We use Helmet.js, don't flag HTTP headers"
dev-crew feedback test "We prefer describe/it blocks over test() calls"

# In interactive mode
❯ /feedback review never suggest class components, always hooks
❯ /feedback fix preserve existing comments when fixing code
```

### Token Management

```bash
# Estimate tokens before running
dev-crew tokens estimate src/

# View usage history
dev-crew tokens usage
```

### CI/CD Integration

```yaml
# .github/workflows/review.yml
name: Code Review
on: [pull_request]
jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm install -g dev-crew
      - run: dev-crew review src/ --ci
        # Exit code 0 = pass, 2 = critical issues found
```

---

## 🔌 Multi-Provider Support

Dev-Crew auto-detects installed AI tools and picks the best one:

| Provider | Detection | Priority |
|---|---|---|
| **Claude Code** | `claude --version` | 1 (highest) |
| **Aider** | `aider --version` | 2 |
| **GitHub Copilot** | `gh copilot` | 3 |
| **OpenAI CLI** | `openai --version` | 4 |
| **Ollama** | `ollama --version` | 5 |
| **Simulation** | Always available | Fallback |

```bash
# Check available providers
dev-crew doctor

# Switch provider in interactive mode
❯ /provider ollama
✓ Ollama

# Force simulation mode (no AI needed)
❯ /provider simulation
```

**No providers installed?** Dev-Crew runs in **simulation mode** — you can explore every command and see the output format without any AI backend.

---

## ⚙️ Configuration

### Initialize Project Config

```bash
dev-crew init
```

Creates `.dev-crew/config.yml`:

```yaml
project:
  name: my-app
  stack: nestjs
  database: postgresql
  orm: prisma
  test_framework: vitest

settings:
  max_tokens_per_request: 8000
  show_token_usage: true
  auto_include_schema: true
  confirm_before_apply: true

agents:
  review:
    severity: normal
    rules:
      - "Always check for SQL injection in raw queries"
      - "Enforce strict TypeScript — no 'any' types"
    ignore:
      - "**/*.spec.ts"
      - "src/generated/**"
    focus:
      - security
      - performance
      - error-handling
  test:
    framework: vitest
    coverage_target: 80
```

### Configuration Commands

```bash
# View full config
dev-crew config show

# Get a setting
dev-crew config get settings.max_tokens_per_request

# Update a setting
dev-crew config set settings.max_tokens_per_request 16000
```

---

## 🛠️ Supported Stacks

Dev-Crew auto-detects your technology stack:

| Category | Supported |
|---|---|
| **Languages** | TypeScript, JavaScript, Python, Go, Rust, Java, Kotlin, Swift, Dart, C#, Ruby, PHP, C/C++ |
| **Web Frameworks** | NestJS, Express, Fastify, Hono, Next.js, Nuxt, React, Vue, Angular, Svelte, Astro, Django, Flask, FastAPI, Rails, Laravel, Spring Boot |
| **Mobile** | Flutter, React Native, SwiftUI/UIKit, Jetpack Compose |
| **Databases** | PostgreSQL, MySQL, MongoDB, Redis, SQLite |
| **ORMs** | Prisma, Drizzle, TypeORM, Sequelize, Mongoose, Knex |
| **Testing** | Vitest, Jest, Mocha, Pytest, Go testing |
| **CI/CD** | GitHub Actions, GitLab CI, Jenkins, CircleCI |
| **Package Managers** | npm, pnpm, yarn, bun |

---

## 📋 All 48 Commands

<details>
<summary><strong>Click to expand full command list</strong></summary>

### Setup
| Command | Description |
|---|---|
| `dev-crew init` | Initialize Dev-Crew in your project |
| `dev-crew doctor` | Check system setup and requirements |

### Core
| Command | Description |
|---|---|
| `dev-crew review [path]` | Code review (`--depth`, `--explain`, `--git-aware`, `--ci`) |
| `dev-crew fix <file>` | Fix issues (`--issue`, `--auto-apply`, `--dry-run`) |
| `dev-crew debug <input>` | Debug from logs/errors/stack traces |
| `dev-crew test <file>` | Generate tests (`--type unit\|integration\|e2e`) |

### Advanced
| Command | Description |
|---|---|
| `dev-crew tech-lead [question]` | Architecture decisions |
| `dev-crew ba <requirement>` | Requirements to specs |
| `dev-crew cto <action>` | Strategic technical review |
| `dev-crew pr <action>` | PR review (`--branch`) |
| `dev-crew security [path]` | Security audit |
| `dev-crew designer <type>` | API/schema design review |

### Smart Features
| Command | Description |
|---|---|
| `dev-crew ask <question>` | Codebase Q&A |
| `dev-crew explain <file>` | Code explanation |
| `dev-crew onboard` | New developer guide |
| `dev-crew watch [path]` | Auto-review on file changes |
| `dev-crew impact <file>` | Change impact analysis |
| `dev-crew resolve` | Merge conflict resolution |
| `dev-crew interactive` | Interactive REPL mode |

### Multi-Agent
| Command | Description |
|---|---|
| `dev-crew feature <desc>` | BA → Tech Lead → Security → Tests → Review |
| `dev-crew refactor-plan <path>` | Prioritized refactoring plan |

### Code Health
| Command | Description |
|---|---|
| `dev-crew debt <action>` | Technical debt tracker |
| `dev-crew migration-check <path>` | Migration safety check |
| `dev-crew deps <action>` | Dependency health scanner |

### DevOps
| Command | Description |
|---|---|
| `dev-crew devops [question]` | Docker, CI/CD, infrastructure |
| `dev-crew cost-optimizer [question]` | Cost analysis |
| `dev-crew deploy [question]` | Deployment strategy |
| `dev-crew monitoring [question]` | Observability and alerting |

### Full-Stack
| Command | Description |
|---|---|
| `dev-crew scaffold <desc>` | Scaffold new project |
| `dev-crew build <desc>` | Build a feature (`--stack`) |
| `dev-crew fullstack-builder <desc>` | Full-stack architecture |
| `dev-crew db-architect [input]` | Database design |
| `dev-crew api-architect [input]` | API design |

### Mobile
| Command | Description |
|---|---|
| `dev-crew flutter [input]` | Flutter/Dart |
| `dev-crew react-native [input]` | React Native |
| `dev-crew ios [input]` | iOS/Swift |
| `dev-crew android [input]` | Android/Kotlin |

### Quality
| Command | Description |
|---|---|
| `dev-crew performance [path]` | Performance audit |
| `dev-crew accessibility [path]` | WCAG compliance |

### Analytics
| Command | Description |
|---|---|
| `dev-crew tokens <action>` | Token management |
| `dev-crew analytics` | Developer analytics |
| `dev-crew sprint-report` | Sprint summary (`--days`) |
| `dev-crew stats` | npm download stats |

### Configuration
| Command | Description |
|---|---|
| `dev-crew agents <action>` | List/inspect agents |
| `dev-crew config <action>` | Manage config |
| `dev-crew feedback <agent> <msg>` | Teach agents |
| `dev-crew patterns` | View learned patterns |

</details>

---

## Architecture

```
dev-crew
├── bin/dev-crew.ts              # CLI entry point (Commander.js)
├── src/
│   ├── agents/                  # 24 specialized AI agents
│   │   ├── base-agent.ts        # Shared execution engine
│   │   ├── registry.ts          # Agent factory
│   │   └── */agent.ts           # Individual agents
│   ├── commands/                # CLI command handlers
│   │   └── interactive.ts       # REPL mode
│   ├── core/
│   │   ├── provider-bridge.ts   # Multi-provider abstraction
│   │   ├── nlp-router.ts        # Natural language → agent routing
│   │   ├── context-engine.ts    # Smart context gathering
│   │   ├── token-optimizer.ts   # Token compression
│   │   ├── project-detector.ts  # Stack auto-detection
│   │   └── config-manager.ts    # YAML config management
│   ├── features/                # Debt tracker, patterns, analytics
│   └── types/                   # TypeScript interfaces
├── .github/workflows/           # CI + npm stats
└── tsup.config.ts               # Build config (ESM, Node 18+)
```

---

## Dev-Crew vs Other Tools

| Feature | Dev-Crew | Claude Code | GitHub Copilot | Cursor |
|---|---|---|---|---|
| Specialized agents (24) | ✅ | ❌ | ❌ | ❌ |
| Code review with framework context | ✅ | ✅ | Limited | ✅ |
| Security audit (OWASP) | ✅ | Manual | ❌ | ❌ |
| Test generation | ✅ | Manual | ❌ | Limited |
| DevOps/Docker/K8s guidance | ✅ | Manual | ❌ | ❌ |
| Mobile (Flutter/RN/iOS/Android) | ✅ | ❌ | ❌ | ❌ |
| DB schema design | ✅ | ❌ | ❌ | ❌ |
| API architecture review | ✅ | ❌ | ❌ | ❌ |
| Multi-provider (5 backends) | ✅ | Claude only | Copilot only | Multiple |
| Works without API key | ✅ | ❌ | ❌ | ❌ |
| Feedback/learning system | ✅ | ❌ | ❌ | ❌ |
| Interactive REPL | ✅ | ✅ | ❌ | ✅ |
| CI/CD integration | ✅ | ❌ | ❌ | ❌ |
| Open source | ✅ | ❌ | ❌ | ❌ |
| Price | **Free** | Paid | Paid | Paid |

---

## Troubleshooting

### "No AI provider found"

Dev-Crew needs at least one AI tool installed. Install any of:

```bash
# Claude Code (recommended)
npm install -g @anthropic-ai/claude-code

# Or Ollama (free, runs locally)
# See: https://ollama.ai

# Or use simulation mode (no install needed)
dev-crew    # auto-falls back to simulation
```

### "Timeout" errors

For large codebases, target specific files:

```bash
# Instead of reviewing entire src/
dev-crew review @src/controllers/auth.ts

# In interactive mode
❯ review @src/services/user.ts
```

### Command not found after install

```bash
# Check install location
npm list -g dev-crew

# If using nvm, ensure correct node version
nvm use 20
npm install -g dev-crew
```

---

## Contributing

Contributions welcome! Please open an issue or submit a pull request.

```bash
git clone https://github.com/vasoyaprince14/dev-crew.git
cd dev-crew
npm install
npm run dev     # Watch mode
npm test        # Run tests
npm run build   # Production build
```

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

<p align="center">
  <strong>Built by <a href="https://github.com/vasoyaprince14">Prince Vasoya</a></strong><br/>
  <sub>
    <a href="https://www.npmjs.com/package/dev-crew">npm</a> &bull;
    <a href="https://github.com/vasoyaprince14/dev-crew/issues">Report Bug</a> &bull;
    <a href="https://github.com/vasoyaprince14/dev-crew/issues">Request Feature</a>
  </sub>
</p>

<p align="center">
  <sub>If Dev-Crew helps you, please give it a ⭐ on GitHub — it helps others discover it!</sub>
</p>

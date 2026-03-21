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
  <strong>Build Complete Apps from a Single Prompt — 25 AI Agents, One CLI</strong><br/>
  <sub>App builder + code review, testing, security, DevOps. Works on Claude Code. Free & open source.</sub>
</p>

<p align="center">
  <a href="#-build-an-app-in-one-command">App Builder</a> &bull;
  <a href="#-quick-start">Quick Start</a> &bull;
  <a href="#-all-25-agents">All Agents</a> &bull;
  <a href="#-interactive-mode">Interactive Mode</a> &bull;
  <a href="#-complete-guide">Guide</a> &bull;
  <a href="#-multi-provider-support">Providers</a>
</p>

---

## What is Dev-Crew?

Dev-Crew is a **free, open-source CLI** that builds complete apps from a single prompt — and gives you **25 specialized AI agents** for every stage of development.

```bash
npm install -g dev-crew

# Build a complete app
dev-crew create "build an uber clone with React and Node.js"

# Or use any of the 25 agents
dev-crew review @src/app.ts
dev-crew test @src/auth.ts
dev-crew security @src/
```

No API keys needed. Works on top of **Claude Code** (free). Zero config.

---

## Build an App in One Command

```bash
dev-crew create "build a todo app with Next.js and PostgreSQL"
```

Dev-Crew asks you a few questions, then runs a **6-stage AI pipeline**:

```
  Step 1: Requirements    — AI business analyst scopes your app
  Step 2: Architecture    — Tech lead designs the system
  Step 3: Code Generation — App creator writes every file
  Step 4: Database & API  — DB architect refines schema
  Step 5: Tests           — Test agent generates test suite
  Step 6: DevOps          — Docker, CI/CD, deployment configs
```

Result: A complete, runnable project written to disk with `npm install` and `git init` done automatically.

```bash
# Options
dev-crew create "SaaS dashboard" --stack "nextjs+postgres" --yes
dev-crew create "chat app" --output ./my-chat-app --no-install
```

---

## Why Dev-Crew Over Other AI Tools?

| Problem | Dev-Crew's Answer |
|---|---|
| Want to build a full app but don't know where to start | **`dev-crew create`** — describe your app, get production-ready code |
| Generic AI gives surface-level reviews | **25 domain-expert agents** — security agent knows OWASP, DevOps agent knows Kubernetes |
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

## 🤖 All 25 Agents

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
| `/agents` | List all 25 agents with descriptions |
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

Dev-Crew works **on top of existing AI tools** — no extra API keys needed. Just install Claude Code (or any provider) and Dev-Crew uses it automatically.

| Provider | Detection | Priority | Notes |
|---|---|---|---|
| **Claude Code** | `claude --version` | 1 (default) | No extra setup — just works |
| **Aider** | `aider --version` | 2 | |
| **GitHub Copilot** | `gh copilot` | 3 | |
| **OpenAI CLI** | `openai --version` | 4 | |
| **Ollama** | `ollama --version` | 5 | Free, runs locally |
| **Claude API** | `ANTHROPIC_API_KEY` | Optional | Direct API — real streaming, exact tokens |
| **Simulation** | Always available | Fallback | Works without any AI installed |

### Default Setup (Zero Config)

```bash
# If you have Claude Code installed, Dev-Crew just works
npm install -g dev-crew
dev-crew
```

### Optional: Direct Claude API

For power users who want real token-by-token streaming and exact token counts:

```bash
# Optional — only if you want direct API access
export ANTHROPIC_API_KEY=sk-ant-...
npm install @anthropic-ai/sdk

# Then switch in interactive mode
❯ /provider claude-api
```

### Switching Providers

```bash
# Check available providers
dev-crew doctor

# Switch in interactive mode
❯ /provider claude-code    # Default
❯ /provider ollama         # Local, free
❯ /provider simulation     # No AI needed
```

**No providers installed?** Dev-Crew runs in **simulation mode** — explore every command without any AI backend.

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
| `dev-crew create <desc>` | **Build complete app from a prompt** |
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

## What Can You Build with Dev-Crew?

Dev-Crew can generate any type of application. Here are example prompts:

```bash
# SaaS & Web Apps
dev-crew create "build a project management tool like Jira with Next.js and PostgreSQL"
dev-crew create "build a SaaS analytics dashboard with Stripe billing"
dev-crew create "build an e-commerce store with product catalog, cart, and checkout"
dev-crew create "build a blog platform with markdown editor and SEO"

# Marketplaces & Platforms
dev-crew create "build an Airbnb clone with booking system and payments"
dev-crew create "build a freelancer marketplace with job posting and bidding"
dev-crew create "build a food delivery app like DoorDash"

# Real-Time & Social
dev-crew create "build a real-time chat app with WebSocket and file sharing"
dev-crew create "build a social media platform with feeds, likes, and comments"
dev-crew create "build a video conferencing app with screen sharing"

# AI & Developer Tools
dev-crew create "build an AI chatbot with RAG and document upload"
dev-crew create "build a URL shortener with analytics dashboard"
dev-crew create "build a REST API with authentication, rate limiting, and docs"

# Mobile Apps
dev-crew create "build a fitness tracking app with React Native"
dev-crew create "build a ride-sharing app like Uber with real-time GPS"
```

Each prompt generates a **complete, runnable project** — not just boilerplate. You get real authentication, database schemas, API routes, frontend pages, tests, Docker configs, and CI/CD pipelines.

---

## Architecture

```
dev-crew
├── bin/dev-crew.ts              # CLI entry point (Commander.js)
├── src/
│   ├── agents/                  # 25 specialized AI agents
│   │   ├── base-agent.ts        # Shared execution engine
│   │   ├── registry.ts          # Agent factory
│   │   ├── app-creator/         # Full app generation agent
│   │   └── */agent.ts           # Individual agents
│   ├── commands/                # CLI command handlers
│   │   ├── create.ts            # App builder command
│   │   └── interactive.ts       # REPL mode
│   ├── pipelines/               # Multi-agent orchestration
│   │   └── create-pipeline.ts   # 6-stage app build pipeline
│   ├── core/
│   │   ├── provider-bridge.ts   # Multi-provider abstraction
│   │   ├── discovery.ts         # Interactive Q&A for app builder
│   │   ├── file-writer.ts       # Safe file writing utility
│   │   ├── nlp-router.ts        # Natural language → agent routing
│   │   ├── context-engine.ts    # Smart context gathering
│   │   └── project-detector.ts  # Stack auto-detection
│   ├── features/                # Debt tracker, patterns, analytics
│   └── types/                   # TypeScript interfaces
├── .github/workflows/           # CI + npm stats
└── tsup.config.ts               # Build config (ESM, Node 18+)
```

---

## Dev-Crew vs Other Tools

| Feature | Dev-Crew | Claude Code | GitHub Copilot | Cursor | v0 / Bolt |
|---|---|---|---|---|---|
| Build complete apps from prompt | ✅ | Manual | ❌ | ❌ | ✅ |
| 25 specialized agents | ✅ | ❌ | ❌ | ❌ | ❌ |
| Code review with framework context | ✅ | ✅ | Limited | ✅ | ❌ |
| Security audit (OWASP) | ✅ | Manual | ❌ | ❌ | ❌ |
| Test generation | ✅ | Manual | ❌ | Limited | ❌ |
| DevOps/Docker/K8s guidance | ✅ | Manual | ❌ | ❌ | ❌ |
| Mobile (Flutter/RN/iOS/Android) | ✅ | ❌ | ❌ | ❌ | ❌ |
| DB schema + migrations | ✅ | ❌ | ❌ | ❌ | Limited |
| API architecture review | ✅ | ❌ | ❌ | ❌ | ❌ |
| Multi-provider (5 backends) | ✅ | Claude only | Copilot only | Multiple | Proprietary |
| Works without API key | ✅ | ❌ | ❌ | ❌ | ❌ |
| Feedback/learning system | ✅ | ❌ | ❌ | ❌ | ❌ |
| CI/CD integration | ✅ | ❌ | ❌ | ❌ | ❌ |
| Open source | ✅ | ❌ | ❌ | ❌ | ❌ |
| Free | **Yes** | Paid | Paid | Paid | Freemium |

**Dev-Crew is the best free, open-source alternative to v0, Bolt, Lovable, and other AI app builders** — but it runs locally, works on top of Claude Code, and gives you full control over the generated code.

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

## Frequently Asked Questions

### How do I build an app with AI for free?

Install Dev-Crew (`npm install -g dev-crew`) and run `dev-crew create "describe your app"`. It works on top of Claude Code — no API keys or subscriptions needed. Dev-Crew's 6-stage AI pipeline generates requirements, architecture, complete code, database schemas, tests, and deployment configs automatically.

### What's the best free alternative to v0, Bolt, or Lovable?

Dev-Crew is a free, open-source CLI that generates complete applications from a single prompt — similar to v0, Bolt.new, and Lovable, but runs locally and gives you full control. Unlike those tools, Dev-Crew also includes 25 specialized agents for code review, testing, security auditing, and DevOps.

### How do I generate a full-stack app from the command line?

```bash
npm install -g dev-crew
dev-crew create "build a SaaS dashboard with Next.js, PostgreSQL, and Stripe"
```

Dev-Crew asks clarifying questions, then generates every file — frontend, backend, database, auth, tests, Docker, and CI/CD configs.

### Can I use Dev-Crew for vibe coding?

Yes. Dev-Crew is built for vibe coding — describe what you want in plain English and get production-ready code. Use `dev-crew create` for new apps, or use any of the 25 agents in interactive mode for ongoing development.

### What AI tools does Dev-Crew work with?

Dev-Crew works on top of Claude Code (default), Aider, GitHub Copilot, OpenAI CLI, Ollama, or the direct Claude API. It auto-detects which tools you have installed and uses the best available option. No configuration needed.

### How do I do AI code review from the terminal?

```bash
npm install -g dev-crew
dev-crew review src/          # Review entire directory
dev-crew review @src/app.ts   # Review specific file
dev-crew security src/        # OWASP security audit
```

### Is Dev-Crew better than using ChatGPT for coding?

Dev-Crew is purpose-built for software engineering with 25 specialized agents, automatic project context detection, framework-aware analysis, and file-level precision. Instead of copy-pasting code into ChatGPT, Dev-Crew reads your codebase, understands your stack, and gives targeted feedback. It also generates complete apps, runs security audits, creates tests, and integrates with CI/CD.

### How do I scaffold a new project with AI?

```bash
dev-crew create "describe your project"   # Full app with all files
dev-crew scaffold "project description"   # Just the structure
dev-crew build "feature description"      # Add feature to existing project
```

### Does Dev-Crew support mobile app development?

Yes. Dev-Crew has dedicated agents for Flutter, React Native, iOS (Swift), and Android (Kotlin). Use `dev-crew flutter`, `dev-crew react-native`, `dev-crew ios`, or `dev-crew android` for mobile-specific code review and guidance.

---

## Use Cases

- **Startup founders**: Go from idea to MVP in minutes with `dev-crew create`
- **Solo developers**: Get code reviews, security audits, and architecture guidance without a team
- **Students**: Learn best practices through AI-powered code analysis
- **Teams**: Integrate into CI/CD for automated code review on every PR
- **Open source maintainers**: Auto-review contributions, generate tests, audit security
- **Freelancers**: Scaffold client projects faster, maintain consistent quality
- **Hackathon participants**: Build and deploy apps in record time

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

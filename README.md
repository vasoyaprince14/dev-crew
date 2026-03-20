# Dev-Crew

**AI-powered developer crew built by Prince Vasoya.**

Dev-Crew is a CLI tool that provides 24 specialized AI agents, 48 commands, and an interactive REPL mode for code review, debugging, testing, security auditing, architecture decisions, mobile development (Flutter, React Native, iOS, Android), DevOps, cost optimization, and more — AI-powered developer tools built by Prince Vasoya. Multi-provider support (Claude Code, Aider, GitHub Copilot, OpenAI, Ollama) with simulation mode. Zero cloud infrastructure.

---

## Why Dev-Crew?

| Problem | Dev-Crew Solution |
|---|---|
| Generic AI code review | Project-aware review with framework-specific rules |
| Manual context gathering | Auto-detects language, framework, DB, ORM, test runner |
| Token waste | Smart context compression saves 40-70% tokens |
| One-size-fits-all agents | 24 specialized agents (review, security, DevOps, mobile, etc.) |
| Locked to one AI provider | Multi-provider: Claude Code, Aider, Copilot, OpenAI, Ollama |
| No way to try without AI | Simulation mode — works without any AI installed |
| No learning | Pattern library + feedback system that improves over time |
| No metrics | Built-in analytics, debt tracking, and sprint reports |

---

## Features

### Core Agents (Free Tier)
- **Review** — Deep code review with framework-specific rules (NestJS, Express, Fastify, etc.)
- **Fix** — Suggest and apply code fixes with minimal diffs
- **Debug** — Root cause analysis from logs, errors, or stack traces
- **Test** — Generate unit/integration/e2e tests matching your project's patterns
- **Onboard** — Generate onboarding guides for new developers
- **Ask** — Ask any question about your codebase

### Advanced Agents (Pro Tier)
- **Tech Lead** — Architecture decisions with trade-offs and effort/impact ratings
- **Business Analyst (BA)** — Translate requirements into technical specs and user stories
- **CTO** — Strategic technical review across 7 dimensions with grades
- **PR Reviewer** — Automated pull request review with approve/request_changes verdict
- **Security** — OWASP Top 10 audit with exploit scenarios and fix guidance
- **Designer** — API and database schema design review

### v2: DevOps & Infrastructure Agents
- **DevOps** — Docker optimization, CI/CD pipeline generation, Terraform/IaC guidance
- **Cost Optimizer** — Deployment cost analysis, provider comparison (AWS/GCP/Azure/Vercel/Railway)
- **Monitoring** — Observability setup, alerting rules, logging strategy, APM configuration

### v2: Full-Stack Builder Agents
- **Full-Stack Builder** — Scaffold entire apps, generate boilerplate, project architecture
- **DB Architect** — Schema design, query optimization, indexing strategy, migration planning
- **API Architect** — REST/GraphQL design review, versioning, rate limiting, error standards

### v2: Mobile Development Agents
- **Flutter** — Dart/Flutter code review, widget composition, state management
- **React Native** — RN development, navigation, native modules, performance
- **iOS** — Swift/SwiftUI review, memory management, App Store guidelines
- **Android** — Kotlin/Jetpack Compose review, lifecycle, Play Store guidelines

### v2: Quality & Performance Agents
- **Performance** — Frontend/backend performance audit, bundle analysis, caching
- **Accessibility** — WCAG 2.1 compliance audit, screen reader support, keyboard navigation

### Multi-Provider AI Support
Dev-Crew auto-detects and works with any of these AI backends:
- **Claude Code** — Anthropic's CLI (highest priority)
- **Aider** — Open-source AI pair programming
- **GitHub Copilot** — Via `gh copilot`
- **OpenAI CLI** — GPT-4o via OpenAI's CLI
- **Ollama** — Run local models (Llama 3, etc.)
- **Simulation Mode** — Works without any AI installed (returns mock responses for testing)

### Interactive REPL Mode
Start an interactive session and use natural language to invoke any agent:
```bash
dev-crew interactive   # or: dev-crew i

# Inside the REPL:
❯ review src/index.ts
❯ fix the login bug
❯ write tests for utils/helper.ts
❯ explain how the auth flow works
❯ check security of the API routes
❯ /help                # show commands
❯ /agents              # list all agents
❯ /providers           # show detected AI providers
❯ /quit                # exit
```

### 25 Built-in Features (USPs)

| # | Feature | Description |
|---|---|---|
| 1 | **Token Intelligence** | Track and optimize token usage across sessions |
| 2 | **Token Budget** | Set daily/weekly token budgets with warnings |
| 3 | **Smart Context** | Compress context to send only what matters |
| 4 | **Dependency Graph** | Auto-resolve imports and show dependency trees |
| 5 | **Git Intelligence** | Hotspot detection, commit pattern analysis, coverage tracking |
| 6 | **Schema-Aware** | Auto-inject Prisma/Drizzle/TypeORM schemas into reviews |
| 7 | **Environment-Aware** | Detect and include relevant config files |
| 8 | **Quality Scoring** | Before/after quality scores across 5 dimensions |
| 9 | **Debt Tracker** | Persistent technical debt tracking with trends |
| 10 | **Feature Pipeline** | Multi-agent workflow: BA → Tech Lead → Security → Tests → Review |
| 11 | **Agent Collaboration** | Agents share context and build on each other's output |
| 12 | **Watch Mode** | Real-time file watching with auto-review on save |
| 13 | **Explain Mode** | Educational explanations for every issue found |
| 14 | **Onboarding Agent** | Codebase tour for new team members |
| 15 | **Ask Agent** | Free-form Q&A about your code |
| 16 | **Conflict Resolver** | AI-assisted merge conflict resolution |
| 17 | **CI/CD Integration** | JSON output mode with exit codes for pipelines |
| 18 | **Team Config** | Shared YAML config with per-agent overrides |
| 19 | **Impact Analysis** | Show blast radius of changing any file |
| 20 | **Developer Analytics** | Track improvement trends and patterns over time |
| 21 | **Pattern Library** | Learn recurring issues and inject into future reviews |
| 22 | **Refactor Planner** | Prioritized refactoring plans with effort/impact |
| 23 | **Migration Safety** | Database migration safety checks |
| 24 | **Dependency Health** | Scan for outdated, vulnerable, or unused packages |
| 25 | **Sprint Reports** | Generate sprint summaries with metrics |

---

## Installation

### Prerequisites

- **Node.js** >= 18.0.0
- **AI provider** (any one of: Claude Code, Aider, GitHub Copilot, OpenAI CLI, Ollama) — or use **simulation mode** without any AI installed

### Install from npm

```bash
npm install -g dev-crew
```

### Install from source

```bash
git clone https://github.com/vasoyaprince14/dev-crew.git
cd dev-crew
npm install
npm run build
npm link
```

### Verify installation

```bash
dev-crew doctor
```

---

## Quick Start

```bash
# Initialize in your project
cd your-project
dev-crew init

# Review code
dev-crew review src/

# Review with git history analysis
dev-crew review src/ --git-aware

# Fix issues in a file
dev-crew fix src/api/handler.ts

# Debug an error
dev-crew debug "TypeError: Cannot read property 'id' of undefined"

# Generate tests
dev-crew test src/services/auth.ts --type unit

# Interactive mode — natural language REPL
dev-crew interactive

# Ask about your codebase
dev-crew ask "How does authentication work?"

# Get architecture guidance
dev-crew tech-lead "Should we use microservices or monolith?"

# Security audit
dev-crew security src/

# Full feature pipeline
dev-crew feature "Add user authentication with JWT"

# Scaffold a new project
dev-crew scaffold "React + Express + Postgres todo app"

# DevOps guidance
dev-crew devops "Optimize my Dockerfile for production"

# Cost optimization
dev-crew cost-optimizer "Best hosting for a Node.js API with 10k daily users"

# Mobile development
dev-crew flutter lib/screens/home.dart
dev-crew react-native "How to implement push notifications?"
dev-crew ios "Best practice for Core Data with SwiftUI?"
dev-crew android src/main/kotlin/MainActivity.kt

# Performance & accessibility
dev-crew performance src/
dev-crew accessibility src/components/
```

---

## All Commands

### Setup
| Command | Description |
|---|---|
| `dev-crew init` | Initialize Dev-Crew in your project |
| `dev-crew doctor` | Check system setup and project configuration |

### Core Agents
| Command | Description |
|---|---|
| `dev-crew review [path]` | Code review with project-aware rules |
| `dev-crew fix <file>` | Suggest and apply code fixes |
| `dev-crew debug <input>` | Root cause analysis from logs/errors |
| `dev-crew test <file>` | Generate tests for a file |

### Advanced Agents
| Command | Description |
|---|---|
| `dev-crew tech-lead [question]` | Architecture decisions and guidance |
| `dev-crew ba <requirement>` | Translate requirements into technical specs |
| `dev-crew cto <action>` | Strategic technical review |
| `dev-crew pr <action>` | PR review |
| `dev-crew security [path]` | Security audit and vulnerability detection |
| `dev-crew designer <type>` | API or schema design review |

### Smart Features
| Command | Description |
|---|---|
| `dev-crew ask <question>` | Ask any question about your codebase |
| `dev-crew explain <file>` | Get a detailed explanation of a code file |
| `dev-crew onboard` | Generate onboarding guide for new developers |
| `dev-crew watch [path]` | Watch files and review changes in real-time |
| `dev-crew impact <file>` | Show impact analysis of changing a file |
| `dev-crew resolve` | AI-assisted merge conflict resolution |

### Multi-Agent Workflows
| Command | Description |
|---|---|
| `dev-crew feature <description>` | Full pipeline: BA → Tech Lead → Security → Tests → Review |
| `dev-crew refactor-plan <path>` | Generate a prioritized refactoring plan |

### Code Health
| Command | Description |
|---|---|
| `dev-crew debt <action>` | Technical debt tracker (`debt report`, `debt scan`) |
| `dev-crew migration-check <path>` | Check database migration for safety issues |
| `dev-crew deps <action>` | Dependency health scanner (`deps health`) |

### Token Intelligence
| Command | Description |
|---|---|
| `dev-crew tokens <action> [target]` | Token management (`tokens estimate`, `tokens usage`) |

### Analytics & Reports
| Command | Description |
|---|---|
| `dev-crew analytics` | View developer analytics and improvement trends |
| `dev-crew sprint-report` | Generate a sprint summary report |

### DevOps & Infrastructure (v2)
| Command | Description |
|---|---|
| `dev-crew devops [question]` | Docker, CI/CD, and infrastructure guidance |
| `dev-crew cost-optimizer [question]` | Deployment cost analysis and optimization |
| `dev-crew deploy [question]` | Get a complete deployment strategy |
| `dev-crew monitoring [question]` | Observability, alerting, and logging strategy |

### Full-Stack Builder (v2)
| Command | Description |
|---|---|
| `dev-crew scaffold <description>` | Scaffold a new full-stack project |
| `dev-crew build <description>` | Build a feature into your existing project |
| `dev-crew fullstack-builder <description>` | Full-stack architecture and scaffolding |
| `dev-crew db-architect [path-or-question]` | Database schema design and optimization |
| `dev-crew api-architect [path-or-question]` | API design review and best practices |

### Mobile Development (v2)
| Command | Description |
|---|---|
| `dev-crew flutter [path-or-question]` | Flutter/Dart development and review |
| `dev-crew react-native [path-or-question]` | React Native development and review |
| `dev-crew ios [path-or-question]` | iOS/Swift development and review |
| `dev-crew android [path-or-question]` | Android/Kotlin development and review |

### Quality & Performance (v2)
| Command | Description |
|---|---|
| `dev-crew performance [path]` | Frontend and backend performance audit |
| `dev-crew accessibility [path]` | WCAG compliance and accessibility audit |

### Interactive Mode
| Command | Description |
|---|---|
| `dev-crew interactive` (or `dev-crew i`) | Interactive REPL with natural language agent routing |

### Configuration
| Command | Description |
|---|---|
| `dev-crew agents <action> [name]` | List and inspect agents |
| `dev-crew config <action> [key] [value]` | Manage configuration |
| `dev-crew feedback [agent] [message]` | Give feedback to improve agent responses |
| `dev-crew patterns` | View learned patterns from your project |

---

## Review Options

```bash
# Quick review
dev-crew review src/ --depth quick

# Deep review with explanations
dev-crew review src/ --depth deep --explain

# Git-aware review (includes hotspot analysis)
dev-crew review src/ --git-aware

# CI mode (JSON output, exit code 2 on critical issues)
dev-crew review src/ --ci

# JSON output
dev-crew review src/ --output json
```

---

## Configuration

Dev-Crew uses a YAML config file at `.dev-crew/config.yml`:

```yaml
# .dev-crew/config.yml
agents:
  review:
    rules:
      - "Always check for SQL injection in raw queries"
      - "Enforce strict TypeScript — no 'any' types"
    maxTokens: 8192
    contextDepth: 3

  security:
    rules:
      - "Flag any use of eval() or Function constructor"

global:
  maxTokens: 8192
  contextDepth: 2
```

### Agent Feedback

Teach agents to improve over time:

```bash
# Give feedback to the review agent
dev-crew feedback review "Focus more on error handling patterns"

# Feedback is persisted and injected into future prompts
```

---

## Architecture

```
dev-crew
├── bin/dev-crew.ts          # CLI entry point (Commander.js)
├── src/
│   ├── agents/              # 24 specialized AI agents
│   │   ├── base-agent.ts    # Abstract base with shared logic
│   │   ├── registry.ts      # Agent registration and creation
│   │   ├── review/          # Code review agent
│   │   ├── fix/             # Fix suggestion agent
│   │   ├── debug/           # Debug/RCA agent
│   │   ├── test/            # Test generation agent
│   │   ├── tech-lead/       # Architecture agent
│   │   ├── business-analyst/# BA agent
│   │   ├── cto/             # Strategic review agent
│   │   ├── pr-reviewer/     # PR review agent
│   │   ├── security/        # Security audit agent
│   │   ├── designer/        # API/schema design agent
│   │   ├── onboard/         # Onboarding agent
│   │   ├── ask/             # Codebase Q&A agent
│   │   ├── devops/          # DevOps/infrastructure agent
│   │   ├── cost-optimizer/  # Cost optimization agent
│   │   ├── fullstack-builder/ # Full-stack scaffolding agent
│   │   ├── db-architect/    # Database architect agent
│   │   ├── api-architect/   # API design agent
│   │   ├── flutter/         # Flutter/Dart agent
│   │   ├── react-native/    # React Native agent
│   │   ├── ios/             # iOS/Swift agent
│   │   ├── android/         # Android/Kotlin agent
│   │   ├── monitoring/      # Monitoring/observability agent
│   │   ├── performance/     # Performance audit agent
│   │   └── accessibility/   # Accessibility audit agent
│   ├── commands/            # 48 CLI command handlers
│   │   ├── interactive.ts   # Interactive REPL mode
│   │   └── ...
│   ├── core/                # Engine components
│   │   ├── provider-bridge.ts # Multi-provider AI bridge (Claude, Aider, Copilot, OpenAI, Ollama)
│   │   ├── nlp-router.ts     # Natural language → agent routing
│   │   ├── project-detector.ts # Auto-detect project stack
│   │   ├── context-engine.ts   # Smart context gathering
│   │   ├── token-optimizer.ts  # Token compression
│   │   ├── token-intelligence.ts # Usage tracking
│   │   ├── dependency-graph.ts   # Import graph builder
│   │   ├── git-intelligence.ts   # Git history analysis
│   │   └── ...
│   ├── features/            # Feature modules
│   │   ├── debt-tracker.ts  # Technical debt tracking
│   │   ├── pattern-library.ts # Pattern learning
│   │   └── analytics.ts     # Developer analytics
│   ├── ui/                  # Terminal UI components
│   │   └── terminal-ui.ts   # ANSI boxes, spinners, score bars, diff colorizer
│   ├── types/               # TypeScript interfaces
│   └── utils/               # Shared utilities
├── templates/               # Config templates
├── tsconfig.json
└── tsup.config.ts           # Build configuration
```

### How It Works

1. **Project Detection** — Automatically detects your language, framework, database, ORM, test runner, and CI platform
2. **Context Gathering** — Reads relevant files, schemas, configs, and dependency graphs
3. **Token Optimization** — Compresses context to minimize token usage (40-70% savings)
4. **Agent Execution** — Sends optimized prompt to AI engine
5. **Response Parsing** — Extracts structured data (issues, fixes, diffs) from AI response
6. **Learning** — Records patterns, updates debt tracker, and tracks analytics

### Zero Infrastructure

Dev-Crew runs entirely on your machine. No external servers required. Built by Prince Vasoya.

---

## CI/CD Integration

```yaml
# GitHub Actions example
- name: Dev-Crew Review
  run: |
    npx dev-crew review src/ --ci
  # Exit code 2 = critical issues found
```

```json
// CI JSON output format
{
  "status": "fail",
  "score": 6,
  "issues": [...],
  "summary": "Found 2 critical security issues",
  "tokens_used": 3200,
  "duration_ms": 4500
}
```

---

## Supported Stacks

**Languages:** TypeScript, JavaScript, Python, Go, Rust, Java, Kotlin, Swift, Dart, C#, Ruby, PHP

**Web Frameworks:** NestJS, Express, Fastify, Next.js, React, Vue, Angular, Django, Flask, FastAPI, Spring Boot, Rails, Laravel

**Mobile Frameworks:** Flutter, React Native, SwiftUI/UIKit (iOS), Jetpack Compose (Android)

**Databases:** PostgreSQL, MySQL, MongoDB, Redis, SQLite

**ORMs:** Prisma, Drizzle, TypeORM, Sequelize, Mongoose

**Test Frameworks:** Jest, Vitest, Mocha, Pytest, Go testing

**CI Platforms:** GitHub Actions, GitLab CI, Jenkins, CircleCI

---

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

```bash
# Development
git clone https://github.com/vasoyaprince14/dev-crew.git
cd dev-crew
npm install
npm run dev  # Watch mode
```

---

## License

MIT

---

Built by Prince Vasoya.

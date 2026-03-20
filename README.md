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
  <strong>AI-Powered Code Review, Debugging, Testing, Security Audit & DevOps CLI</strong><br/>
  <sub>24 specialized AI agents. 48 commands. Works with Claude, OpenAI, Copilot, Aider, Ollama. Zero infrastructure.</sub>
</p>

<p align="center">
  <a href="#installation">Installation</a> &bull;
  <a href="#quick-start">Quick Start</a> &bull;
  <a href="#all-agents">All 24 Agents</a> &bull;
  <a href="#all-commands">48 Commands</a> &bull;
  <a href="#interactive-mode">Interactive Mode</a> &bull;
  <a href="#multi-provider-support">Multi-Provider</a> &bull;
  <a href="#configuration">Configuration</a>
</p>

<p align="center">
  <sub>If you find Dev-Crew useful, please consider giving it a star on GitHub — it helps others discover it!</sub>
</p>

---

## What is Dev-Crew?

Dev-Crew gives you an entire AI development team from your terminal. Instead of one generic AI assistant, you get **24 specialized agents** — each an expert in their domain: code review, security auditing, DevOps, database design, mobile development, and more.

```bash
npm install -g dev-crew
```

```
$ dev-crew doctor

Dev-Crew Doctor
──────────────────────────────────────────────────
 AI Provider: Claude Code (available)
 Config: found at .dev-crew/config.yml
 Project: my-app (typescript / nestjs)
   Framework: nestjs
   Database: postgresql
   ORM: prisma
   Tests: vitest

 Everything looks good!
```

---

## Why Dev-Crew?

| The Problem | Dev-Crew's Solution |
|---|---|
| Generic AI code review | **Project-aware** review that knows your framework, DB, and ORM |
| Copy-pasting context into ChatGPT | **Auto-detects** your stack and gathers relevant files, schemas, configs |
| Token waste on large prompts | **Smart compression** saves 40-70% tokens automatically |
| One AI, many hats | **24 specialized agents** — each trained for a specific job |
| Locked to one AI provider | **Multi-provider** — Claude Code, Aider, Copilot, OpenAI, Ollama |
| Can't try without API keys | **Simulation mode** — works without any AI installed |
| AI doesn't learn your preferences | **Feedback system** — teach agents your coding standards |
| No visibility into AI costs | **Token tracking** with budgets, estimates, and usage reports |

---

## Installation

### Prerequisites

- **Node.js** >= 18.0.0
- **AI provider** (any one): Claude Code, Aider, GitHub Copilot, OpenAI CLI, or Ollama
- Or use **simulation mode** with no AI installed

### Install globally

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

### Verify

```bash
dev-crew doctor
```

---

## Quick Start

```bash
# 1. Initialize in your project
cd your-project
dev-crew init

# 2. Review your code
dev-crew review src/

# 3. Fix issues
dev-crew fix src/api/handler.ts

# 4. Generate tests
dev-crew test src/services/auth.ts

# 5. Start interactive mode
dev-crew i
```

---

## All Agents

### Core Agents (Free)

| Agent | Command | What it does |
|---|---|---|
| **Reviewer** | `dev-crew review [path]` | Deep code review with framework-specific rules |
| **Fixer** | `dev-crew fix <file>` | Suggest and apply code fixes with minimal diffs |
| **Debugger** | `dev-crew debug <input>` | Root cause analysis from logs, errors, stack traces |
| **Tester** | `dev-crew test <file>` | Generate unit/integration/e2e tests |
| **Onboarder** | `dev-crew onboard` | Generate onboarding guide for new developers |
| **Q&A** | `dev-crew ask <question>` | Ask any question about your codebase |

### Advanced Agents (Pro)

| Agent | Command | What it does |
|---|---|---|
| **Tech Lead** | `dev-crew tech-lead [question]` | Architecture decisions with trade-offs |
| **Business Analyst** | `dev-crew ba <requirement>` | Requirements to technical specs |
| **CTO** | `dev-crew cto review` | Strategic review across 7 dimensions |
| **PR Reviewer** | `dev-crew pr review` | Automated pull request review |
| **Security** | `dev-crew security [path]` | OWASP Top 10 audit with fix guidance |
| **Designer** | `dev-crew designer api\|schema` | API and schema design review |

### DevOps & Infrastructure

| Agent | Command | What it does |
|---|---|---|
| **DevOps** | `dev-crew devops [question]` | Docker, CI/CD, Terraform, Kubernetes |
| **Cost Optimizer** | `dev-crew cost-optimizer [question]` | Cloud cost analysis (AWS/GCP/Azure/Vercel) |
| **Monitoring** | `dev-crew monitoring [question]` | Observability, alerting, logging strategy |
| **Deploy** | `dev-crew deploy [question]` | Complete deployment strategy |

### Full-Stack & Database

| Agent | Command | What it does |
|---|---|---|
| **Full-Stack Builder** | `dev-crew scaffold <desc>` | Scaffold entire project structures |
| **DB Architect** | `dev-crew db-architect [input]` | Schema design, query optimization, indexing |
| **API Architect** | `dev-crew api-architect [input]` | REST/GraphQL design, versioning, rate limiting |

### Mobile Development

| Agent | Command | What it does |
|---|---|---|
| **Flutter** | `dev-crew flutter [input]` | Dart/Flutter review, state management |
| **React Native** | `dev-crew react-native [input]` | RN development, navigation, performance |
| **iOS** | `dev-crew ios [input]` | Swift/SwiftUI, memory management |
| **Android** | `dev-crew android [input]` | Kotlin/Jetpack Compose, lifecycle |

### Quality & Performance

| Agent | Command | What it does |
|---|---|---|
| **Performance** | `dev-crew performance [path]` | Frontend/backend performance audit |
| **Accessibility** | `dev-crew accessibility [path]` | WCAG 2.1 compliance audit |

---

## Interactive Mode

Start a REPL session and talk to your agents using natural language:

```bash
dev-crew interactive   # or: dev-crew i
```

```
  ____              _____
 |  _ \  _____   __/ ____|_ __ _____      __
 | | | |/ _ \ \ / / |   | '__/ _ \ \ /\ / /
 | |_| |  __/\ V /| |___| | |  __/\ V  V /
 |____/ \___| \_/  \_____|_|  \___| \_/\_/

  Interactive Mode — type a command or ask a question
  Type /help for available commands, /quit to exit

  Project: my-app (typescript / nestjs)
  Provider: Claude Code (available)

❯ review src/controllers/
❯ fix the authentication bug
❯ write tests for the user service
❯ explain how the middleware works
❯ check security of the API routes
❯ is there any technical debt?
```

### Slash Commands

| Command | Description |
|---|---|
| `/help` | Show available commands |
| `/agents` | List all 24 agents |
| `/providers` | Show detected AI providers |
| `/project` | Show detected project info |
| `/quit` | Exit interactive mode |

---

## All Commands

<details>
<summary><strong>View all 48 commands</strong></summary>

### Setup
| Command | Description |
|---|---|
| `dev-crew init` | Initialize Dev-Crew in your project |
| `dev-crew doctor` | Check system setup and requirements |

### Core
| Command | Description |
|---|---|
| `dev-crew review [path]` | Code review (`--depth quick\|normal\|deep`, `--explain`, `--git-aware`, `--ci`) |
| `dev-crew fix <file>` | Fix code issues (`--issue <description>`) |
| `dev-crew debug <input>` | Debug from logs/errors/stack traces |
| `dev-crew test <file>` | Generate tests (`--type unit\|integration\|e2e`) |

### Advanced
| Command | Description |
|---|---|
| `dev-crew tech-lead [question]` | Architecture decisions |
| `dev-crew ba <requirement>` | Business requirements to specs |
| `dev-crew cto <action>` | Strategic technical review |
| `dev-crew pr <action>` | PR review (`--branch <name>`) |
| `dev-crew security [path]` | Security audit |
| `dev-crew designer <type>` | API/schema design review |

### Smart Features
| Command | Description |
|---|---|
| `dev-crew ask <question>` | Codebase Q&A |
| `dev-crew explain <file>` | Detailed code explanation |
| `dev-crew onboard` | New developer onboarding guide |
| `dev-crew watch [path]` | Real-time file watching with auto-review |
| `dev-crew impact <file>` | Change impact analysis |
| `dev-crew resolve` | AI-assisted merge conflict resolution |
| `dev-crew interactive` | Interactive REPL mode |

### Multi-Agent Workflows
| Command | Description |
|---|---|
| `dev-crew feature <description>` | Full pipeline: BA -> Tech Lead -> Security -> Tests -> Review |
| `dev-crew refactor-plan <path>` | Prioritized refactoring plan |

### Code Health
| Command | Description |
|---|---|
| `dev-crew debt <action>` | Technical debt tracker |
| `dev-crew migration-check <path>` | Database migration safety check |
| `dev-crew deps <action>` | Dependency health scanner |

### DevOps & Infrastructure
| Command | Description |
|---|---|
| `dev-crew devops [question]` | Docker, CI/CD, infrastructure |
| `dev-crew cost-optimizer [question]` | Cost analysis and optimization |
| `dev-crew deploy [question]` | Deployment strategy |
| `dev-crew monitoring [question]` | Observability and alerting |

### Full-Stack
| Command | Description |
|---|---|
| `dev-crew scaffold <description>` | Scaffold a new project |
| `dev-crew build <description>` | Build a feature (`--stack <stack>`) |
| `dev-crew fullstack-builder <description>` | Full-stack architecture |
| `dev-crew db-architect [input]` | Database design and optimization |
| `dev-crew api-architect [input]` | API design review |

### Mobile
| Command | Description |
|---|---|
| `dev-crew flutter [input]` | Flutter/Dart development |
| `dev-crew react-native [input]` | React Native development |
| `dev-crew ios [input]` | iOS/Swift development |
| `dev-crew android [input]` | Android/Kotlin development |

### Quality
| Command | Description |
|---|---|
| `dev-crew performance [path]` | Performance audit |
| `dev-crew accessibility [path]` | WCAG accessibility audit |

### Analytics & Reports
| Command | Description |
|---|---|
| `dev-crew tokens <action> [target]` | Token management (`estimate`, `usage`) |
| `dev-crew analytics` | Developer analytics and trends |
| `dev-crew sprint-report` | Sprint summary report (`--days <n>`) |

### Configuration
| Command | Description |
|---|---|
| `dev-crew agents <action> [name]` | List/inspect agents |
| `dev-crew config <action> [key] [value]` | Manage config (`show`, `set`, `get`) |
| `dev-crew feedback [agent] [message]` | Teach agents your preferences |
| `dev-crew patterns` | View learned patterns |

</details>

---

## Multi-Provider Support

Dev-Crew auto-detects and works with multiple AI backends:

| Provider | Command | Priority |
|---|---|---|
| Claude Code | `claude` | 1 (highest) |
| Aider | `aider` | 2 |
| GitHub Copilot | `gh copilot` | 3 |
| OpenAI CLI | `openai` | 4 |
| Ollama | `ollama` | 5 |
| Simulation | (built-in) | fallback |

Dev-Crew auto-selects the best available provider. If none are installed, **simulation mode** activates automatically — returning realistic mock responses so you can explore every command without an AI backend.

```bash
# Check which providers are available
dev-crew doctor

# In interactive mode
❯ /providers
```

---

## Key Features

### Smart Context Engine
Automatically gathers relevant files, schemas, configs, and dependency graphs — then compresses them to save 40-70% tokens.

### Project Auto-Detection
Detects your language, framework, database, ORM, test runner, package manager, CI platform, and project structure on first run.

### Feedback System
Teach agents your preferences. Feedback persists across sessions:

```bash
dev-crew feedback review "Always flag any use of 'any' type in TypeScript"
dev-crew feedback security "We use Helmet.js for HTTP headers, don't flag those"
```

### Token Intelligence
Track usage, set budgets, and estimate costs before running commands:

```bash
dev-crew tokens estimate src/
dev-crew tokens usage
```

### CI/CD Integration

```yaml
# GitHub Actions
- name: Dev-Crew Review
  run: npx dev-crew review src/ --ci
  # Exit code 2 = critical issues found
```

### Feature Pipeline
Run multiple agents in sequence on a single feature:

```bash
dev-crew feature "Add JWT authentication with refresh tokens"
# Runs: BA -> Tech Lead -> Security -> Test -> Review
```

---

## Configuration

Dev-Crew stores config in `.dev-crew/config.yml`:

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

```bash
# View config
dev-crew config show

# Update settings
dev-crew config set settings.max_tokens_per_request 16000
```

---

## Supported Stacks

**Languages:** TypeScript, JavaScript, Python, Go, Rust, Java, Kotlin, Swift, Dart, C#, Ruby, PHP

**Web Frameworks:** NestJS, Express, Fastify, Next.js, React, Vue, Angular, Django, Flask, FastAPI, Spring Boot, Rails, Laravel

**Mobile:** Flutter, React Native, SwiftUI/UIKit, Jetpack Compose

**Databases:** PostgreSQL, MySQL, MongoDB, Redis, SQLite

**ORMs:** Prisma, Drizzle, TypeORM, Sequelize, Mongoose

**Testing:** Jest, Vitest, Mocha, Pytest, Go testing

**CI/CD:** GitHub Actions, GitLab CI, Jenkins, CircleCI

---

## Architecture

```
dev-crew
├── bin/dev-crew.ts              # CLI entry (Commander.js, 48 commands)
├── src/
│   ├── agents/                  # 24 specialized AI agents
│   │   ├── base-agent.ts        # Abstract base with shared logic
│   │   ├── registry.ts          # Agent registration and factory
│   │   ├── review/              # Code review
│   │   ├── fix/                 # Code fixes
│   │   ├── debug/               # Root cause analysis
│   │   ├── test/                # Test generation
│   │   ├── security/            # Security audit
│   │   ├── devops/              # DevOps & infrastructure
│   │   ├── flutter/             # Flutter/Dart
│   │   ├── react-native/        # React Native
│   │   ├── ios/                 # iOS/Swift
│   │   ├── android/             # Android/Kotlin
│   │   └── ...                  # 12 more agents
│   ├── commands/                # 48 CLI command handlers
│   │   ├── interactive.ts       # REPL mode
│   │   └── ...
│   ├── core/                    # Engine
│   │   ├── provider-bridge.ts   # Multi-provider AI bridge
│   │   ├── nlp-router.ts        # Natural language routing
│   │   ├── context-engine.ts    # Smart context gathering
│   │   ├── token-optimizer.ts   # Token compression
│   │   ├── project-detector.ts  # Stack auto-detection
│   │   └── ...
│   ├── ui/                      # Terminal UI
│   │   └── terminal-ui.ts       # ANSI boxes, spinners, score bars
│   ├── features/                # Debt tracker, analytics, patterns
│   └── types/                   # TypeScript interfaces
├── tsconfig.json
└── tsup.config.ts               # Build config
```

---

## How Dev-Crew Compares

| Feature | Dev-Crew | Claude Code | GitHub Copilot | Cursor |
|---|---|---|---|---|
| Specialized agents (24) | Yes | No | No | No |
| Code review | Yes | Yes | Limited | Yes |
| Security audit (OWASP) | Yes | Manual | No | No |
| Test generation | Yes | Manual | No | Limited |
| DevOps/Docker guidance | Yes | Manual | No | No |
| Mobile (Flutter/RN/iOS/Android) | Yes | No | No | No |
| DB schema design | Yes | No | No | No |
| API architecture review | Yes | No | No | No |
| Multi-provider support | 5 providers | Claude only | Copilot only | Multiple |
| Works without API key | Yes (simulation) | No | No | No |
| Token optimization | Built-in | No | N/A | No |
| Interactive REPL | Yes | Yes | No | Yes |
| Open source | Yes | No | No | No |
| Price | Free | Paid | Paid | Paid |

---

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

```bash
git clone https://github.com/vasoyaprince14/dev-crew.git
cd dev-crew
npm install
npm run dev   # Watch mode with hot reload
```

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

<p align="center">
  <strong>Built with passion by <a href="https://github.com/vasoyaprince14">Prince Vasoya</a></strong><br/>
  <sub>
    <a href="https://www.npmjs.com/package/dev-crew">npm</a> &bull;
    <a href="https://github.com/vasoyaprince14/dev-crew/issues">Report Bug</a> &bull;
    <a href="https://github.com/vasoyaprince14/dev-crew/issues">Request Feature</a>
  </sub>
</p>

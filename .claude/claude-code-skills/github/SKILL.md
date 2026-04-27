---
name: github
description: Git workflow and (future) GitHub Actions for the signature-sap repo. Read when creating branches, drafting PRs, troubleshooting pre-commit hooks, writing commit messages, or setting up CI. Project currently has NO CI/CD configured.
applies-to: signature-sap
---

# GitHub Skill — Signature Shades

## Project Context
- **Branching:** `feature/<topic>` → `main`. Current active branch examples: `feature/curtains`.
- **Main branch:** `main` (PRs target this).
- **Remote:** standard GitHub origin. `gh` CLI authenticated.
- **CI/CD status:** No GitHub Actions configured yet. Production deploy is manual to AWS EC2 via `docker-compose.prod.yml`.
- **Commit style:** short imperative subject. Recent examples: `Motors & Brackets > Blind Parts`, `worksheet Changes #1`, `Express JSON body parser issue`. Free-form — do NOT impose conventional-commits unless user asks.
- **NEVER auto-commit.** User handles all git commits — see [feedback_no_auto_commit.md](C:\Users\vdula\.claude\projects\f--SIGNATUR-SHADES-signature-sap\memory\feedback_no_auto_commit.md). Make file changes, summarize, and stop. Don't run `git add`/`git commit` unless explicitly told.
- **Hooks:** Never bypass with `--no-verify`/`--no-gpg-sign`. If a hook fails, fix the underlying issue.
- **Secrets discipline:** `.env` files are gitignored — never stage them. Backend uses `JWT_SECRET`, `DATABASE_URL` in `.env`.

## When to Activate
- Drafting PR body / branch name
- Investigating commit history or `git status`
- User explicitly requests a commit, push, or PR
- Setting up first GitHub Actions workflow (none exists yet)

## Sub-Skills
| File | When to Read |
|------|-------------|
| `ci-cd-pipelines.md` | First time setting up GitHub Actions for this repo |
| `branch-strategy.md` | Establishing branch protection on `main` |
| `actions-workflows.md` | Action recipes / reusable workflows |

## Also Read
- `security/auth-and-secrets.md` — Secret handling
- `docker/SKILL.md` — Container building in CI

## Core Git Rules
1. **Never commit secrets** — use `.gitignore` and `git-secrets` pre-commit hook
2. **Never force push to main/prod** — use branch protection
3. **Always use pull requests** — even as a solo dev (for CI checks and history)
4. **Write meaningful commit messages** — future you will thank present you
5. **Keep commits atomic** — one logical change per commit
6. **Tag releases** — use semantic versioning (v1.2.3)
7. **Use .gitignore from day one** — template it per language

## Commit Message Format
```
type(scope): short description

Longer description if needed.

Types:
  feat:     New feature
  fix:      Bug fix
  refactor: Code change (no new feature, no bug fix)
  docs:     Documentation
  test:     Adding or updating tests
  ci:       CI/CD changes
  chore:    Build process, dependencies
  perf:     Performance improvement
  security: Security fix

Examples:
  feat(api): add user registration endpoint
  fix(auth): resolve token expiry race condition
  ci(deploy): add staging environment pipeline
  refactor(db): migrate from raw SQL to SQLAlchemy ORM
```

## Essential .gitignore
```gitignore
# Environment
.env
.env.*
!.env.example

# Dependencies
node_modules/
__pycache__/
*.pyc
.venv/
venv/

# IDE
.vscode/settings.json
.idea/
*.swp

# OS
.DS_Store
Thumbs.db

# Build
dist/
build/
*.egg-info/

# Testing
.coverage
htmlcov/
.pytest_cache/
.nyc_output/
coverage/

# Terraform
*.tfstate
*.tfstate.*
.terraform/
*.tfvars
!*.tfvars.example
crash.log

# Docker
docker-compose.override.yml

# Logs
*.log
logs/
```

## Repository Setup Checklist
```
□ .gitignore configured for the stack
□ .env.example with placeholder values
□ README.md with setup instructions
□ LICENSE file
□ Branch protection on main
□ Required CI checks before merge
□ Dependabot enabled for security updates
□ CODEOWNERS file (even for solo — documents ownership)
□ GitHub Secrets configured for CI/CD
□ Issue templates and PR templates
```

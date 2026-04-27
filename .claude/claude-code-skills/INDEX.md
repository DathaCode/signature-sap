# Signature Shades — Skill Index

This folder contains topical reference skills. Claude should consult them when the matching trigger applies. Each skill's `SKILL.md` has YAML frontmatter with a `description` (the trigger) and a "Project Context" section that overrides any generic advice for this project.

## Active skills (apply to signature-sap)

| Skill | Trigger | Read when |
|-------|---------|-----------|
| [react](react/SKILL.md) | Frontend React/TS work | Editing anything in [frontend/src/](../../frontend/src/) — pages, components, hooks, API calls, AuthContext, forms |
| [typescript](typescript/SKILL.md) | Type errors, API contracts | Defining types, mirroring Prisma schema on the frontend, debugging `tsc` errors |
| [docker](docker/SKILL.md) | Containers / compose | Editing Dockerfile or compose files, installing packages inside containers, debugging hot-reload, prod restarts |
| [terraform](terraform/SKILL.md) | AWS infrastructure | Editing anything in [terraform/](../../terraform/) — EC2, EIP, Route53, S3, security groups; running `plan`/`apply` |
| [github](github/SKILL.md) | Git workflow | Branch naming, drafting PR bodies, commit messages — **never auto-commit**. CI not yet set up. |
| [security](security/SKILL.md) | Auth, validation, secrets | Touching JWT, role gating (CUSTOMER/ADMIN/WAREHOUSE), Express routes, file uploads, CORS, env vars, Terraform security/IAM |
| [self-healing](self-healing/SKILL.md) | A command/test fails | Diagnose root cause; check the project-known-pitfalls list before retrying |
| [cost-reducer](cost-reducer/SKILL.md) | AWS / cost discussion | Sizing the prod EC2, weighing managed services (RDS/S3/CloudFront), budget questions |
| [researcher](researcher/SKILL.md) | Pre-implementation validation | Before adding an npm dep, choosing between approaches, unfamiliar errors |

## Reference-only skills (not currently used — promote when adopted)

These are kept as general references. They are NOT skipped automatically forever — if the project starts using one of these, **promote it** (see "Promoting / demoting a skill" below).

| Skill | Currently not used because… | Promote when… |
|-------|----------------------------|---------------|
| [python](python/SKILL.md) | Backend is Node.js, not Python | Any Python script, FastAPI service, or ML/data tooling lands in the repo |
| [kubernetes](kubernetes/SKILL.md) | Prod is single EC2 + docker-compose | Migration to EKS/OKE, or any `*.yaml` manifest / Helm chart appears |
| [grafana](grafana/SKILL.md) | No metrics pipeline | Grafana / Prometheus / CloudWatch dashboard work begins |
| [kibana](kibana/SKILL.md) | No ELK stack | Centralised logging (ELK / OpenSearch / Datadog) is set up |

> **Important:** Before marking a skill "not used", actually search the repo for related artifacts (e.g., `*.tf`, `*.py`, `*.yaml` manifests, `grafana/`, `kibana/`, `prometheus.yml`). Do not infer absence from CLAUDE.md alone — it may be out of date.

## How Claude picks a skill

1. Look at the file or directory being edited / discussed.
2. Match against the **Trigger** column above.
3. Read `SKILL.md` of the matching skill, then any sub-skill flagged in its "Sub-Skills" table that is relevant to the current change.
4. The "Project Context" section near the top of each `SKILL.md` overrides any generic advice further down.

## Promoting / demoting a skill

Skills move between the two tables as the project evolves. **Always check the live repo first**, not memory.

### Promote (reference-only → active) — when the project starts using the stack
1. Verify by searching the repo (e.g., for grafana: `grep -r "grafana" --include="*.yml" --include="*.tf"`, look for `grafana/` or `monitoring/` folders).
2. Edit that skill's `SKILL.md`:
   - Change frontmatter `applies-to: not-signature-sap` → `applies-to: signature-sap`
   - Replace the "NOT used" banner with a "Project Context" block describing actual config, file paths, and project-specific rules (file references, secrets handling, region, etc.)
   - Update the description to be a concrete trigger (mention the file paths Claude should watch).
3. Move the row in this `INDEX.md` from "Reference-only" → "Active skills" and write a real Trigger / Read-when.
4. If a sub-skill is now project-relevant (e.g., `terraform/aws-modules.md`), cross-link it from the new Project Context block.
5. If the skill encodes non-obvious rules (secrets location, naming conventions, deploy gotchas), add a memory entry in `.claude/projects/.../memory/`.

### Demote (active → reference-only) — when the stack is removed
1. Confirm removal with the user (don't demote based on "I haven't seen it lately").
2. Flip frontmatter back to `applies-to: not-signature-sap`, replace Project Context with a "NOT used" banner that records WHY it was removed and WHEN.
3. Move the row in this `INDEX.md`.

## When adding a brand-new skill

- Place it in its own folder under [.claude/claude-code-skills/](.).
- `SKILL.md` must have YAML frontmatter with `name`, `description`, and `applies-to: signature-sap` (or `not-signature-sap`).
- Add a row to the appropriate table above.
- Add a memory entry only if the skill encodes a non-obvious project rule (otherwise the description in `SKILL.md` is enough — `INDEX.md` is loaded via the `reference_skills_index.md` memory pointer).

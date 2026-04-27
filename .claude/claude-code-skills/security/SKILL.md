---
name: security
description: Security review and hardening for the signature-sap full-stack web app — JWT auth, Express routes, role gating (CUSTOMER/ADMIN/WAREHOUSE), Prisma queries, file uploads, AWS EC2 prod. Read whenever touching auth, validation, secrets, CORS, or user-controllable input.
applies-to: signature-sap
---

# Security Skill — Signature Shades

## Project Context
- **Auth:** JWT (Bearer token), 7-day expiry. Backend: [backend/src/middleware/auth.ts](backend/src/middleware/auth.ts) (`requireAuth`, `requireAdmin`, `requireAdminOrWarehouse`). Frontend stores token in `localStorage` (XSS-sensitive).
- **Roles:** `CUSTOMER | ADMIN | WAREHOUSE`. Always gate sensitive routes server-side — never trust the frontend role check.
- **Secrets:** `.env` only (`JWT_SECRET`, `DATABASE_URL`). Never hardcode. `.env` is gitignored.
- **CORS:** Backend reads `CORS_ORIGIN` env. Production must be specific origin, never `*`.
- **Prisma:** Use the client's parameterized queries — never string-concatenate into `$queryRaw` with user input.
- **File uploads:** [backend/uploads/](backend/uploads/) — validate MIME type and size, store outside web root.
- **Pricing/inventory writes:** Always behind `requireAdmin`. Customers can only POST `/api/web-orders/create`.
- **Express body parser:** Already configured (see commit `659d404`). Don't add duplicate parsers.
- **Production env:** Single AWS EC2 box, internet-facing — no VPC isolation. HTTPS via reverse proxy (verify in [docker-compose.prod.yml](docker-compose.prod.yml)). See [project_aws_deployment.md](C:\Users\vdula\.claude\projects\f--SIGNATUR-SHADES-signature-sap\memory\project_aws_deployment.md).
- **No K8s, no Terraform** — `k8s-security.md` and most of `cloud-security.md` are non-applicable for this project.

## Project-Specific Hot Spots (review when touching)
- Login/Register flow ([backend/src/controllers/auth.controller.ts](backend/src/controllers/auth.controller.ts)) — bcrypt rounds, rate limiting, password reset tokens
- JWT issuance — secret strength, payload exposure, token rotation
- Order endpoints — IDOR risk (`/api/orders/:id` — does it check `userId === req.user.id`?)
- Worksheet downloads — PDF/CSV endpoints must verify role + ownership
- Pricing/inventory mutation endpoints — admin-only enforcement
- File upload endpoints — content-type, size limit, path traversal in filenames

## When to Activate
- Adding/modifying any route, controller, or middleware in [backend/src/](backend/src/)
- Touching JWT, bcrypt, password reset, or role checks
- Editing CORS, rate-limit, or HTTP header config
- Adding a file upload or download endpoint
- Reviewing PRs that touch auth/authorization

## Sub-Skills (Read Before Acting)
| File | When to Read |
|------|-------------|
| `auth-and-secrets.md` | JWT, bcrypt, password reset, env handling — frequent |
| `web-security.md` | Express routes, CORS, headers, XSS, SQL/NoSQL injection — frequent |
| `docker-security.md` | Editing Dockerfiles or compose files |
| `cloud-security.md` | AWS hardening — security groups, IAM, S3 bucket policies. Cross-check against [terraform/security.tf](terraform/security.tf) and [terraform/s3.tf](terraform/s3.tf) |
| `k8s-security.md` | NOT applicable — project does not use Kubernetes |

## Universal Security Rules (Apply Always)
1. **Never hardcode secrets** — use environment variables, vault, or cloud secret managers
2. **Never run as root** — in containers, K8s pods, or cloud instances
3. **Always use HTTPS/TLS** — no exceptions in staging or production
4. **Always validate input** — on both client and server side
5. **Always use least privilege** — IAM roles, K8s RBAC, file permissions
6. **Always scan dependencies** — use `pip audit`, `npm audit`, or GitHub Dependabot
7. **Always tag and version** — never use `latest` tag in production
8. **Always encrypt at rest and in transit** — databases, S3 buckets, secrets
9. **Never expose internal services** — use private subnets, internal load balancers
10. **Always log security events** — auth failures, permission denials, rate limit hits

## Quick Security Checklist (Run Mentally Before Every Output)
```
□ Are there any hardcoded secrets? → Move to secrets manager
□ Is the container running as root? → Add USER directive
□ Are ports unnecessarily exposed? → Close them
□ Is input validated and sanitized? → Add validation
□ Are dependencies pinned to versions? → Pin them
□ Is TLS/HTTPS configured? → Enable it
□ Are IAM permissions too broad? → Narrow them
□ Are security headers set? → Add them
□ Is logging enabled for auth events? → Enable it
□ Is CORS configured correctly? → Restrict origins
```

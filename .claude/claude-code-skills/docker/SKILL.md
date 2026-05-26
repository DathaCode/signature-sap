---
name: docker
description: Docker / Docker Compose work — local dev stack ([docker-compose.yml](docker-compose.yml)) and AWS production ([docker-compose.prod.yml](docker-compose.prod.yml)). Read when editing Dockerfiles, compose files, debugging containers, or installing packages inside containers.
applies-to: signature-sap
---

# Docker Skill — Signature Shades

## Project Context
- **Compose files:**
  - Local dev: [docker-compose.yml](docker-compose.yml) — postgres + backend (port 5000) + frontend (port 3000), hot-reload via volume mounts
  - Production: [docker-compose.prod.yml](docker-compose.prod.yml) — **always use `-f docker-compose.prod.yml`** for prod commands (per memory)
- **Service container names:** `signatureshades-db-local`, `signatureshades-api-local`, `signatureshades-web-local`
- **Network:** `signatureshades-network` (bridge)
- **Hot-reload caveat:** Backend has anonymous volume for `/app/node_modules`. Installing a new package requires either:
  - `docker exec signatureshades-api-local npm install <pkg>` (inside container), OR
  - Edit `package.json` then `docker-compose up -d --build backend`
- **DB credentials (local):** user `signatureshades_dev`, db `signatureshades_dev`, container `signatureshades-db-local`
- **DB shell:** `docker exec -it signatureshades-db-local psql -U signatureshades_dev -d signatureshades_dev`
- **No K8s** — project deploys to a single AWS EC2 box via docker-compose.prod.yml. Skip Kubernetes-flavoured advice.

## When to Activate
- Editing [Dockerfile](Dockerfile) (frontend or backend), [docker-compose.yml](docker-compose.yml), or [docker-compose.prod.yml](docker-compose.prod.yml)
- Debugging container startup, networking, volumes, or hot-reload
- Adding a new npm/system package
- Production deploy / restart on EC2

## Sub-Skills
| File | When to Read |
|------|-------------|
| `dockerfile-patterns.md` | Editing a Dockerfile |
| `compose-patterns.md` | Editing compose files |
| `optimization.md` | Image size or build time concerns |

## Also Read
- `security/docker-security.md` — when editing Dockerfiles
- [feedback_prod_compose.md](C:\Users\vdula\.claude\projects\f--SIGNATUR-SHADES-signature-sap\memory\feedback_prod_compose.md) — production compose flag rule

## Production Deploy Rule — Signature Shades

**NEVER automatically SSH into production or run commands on the EC2 server.**
When production changes are needed, provide the commands for the user to run — never execute them directly.

```bash
# Provide these commands, don't run them:
ssh -i ~/.ssh/signatureshades-ec2 ubuntu@16.26.30.228
cd /home/ubuntu/signature-sap
docker compose -f docker-compose.prod.yml build --no-cache <service>
docker compose -f docker-compose.prod.yml up -d <service>
docker restart signatureshades-nginx
docker exec signatureshades-api-prod <cmd>
docker cp <local-file> signatureshades-api-prod:<container-path>
```

## Core Docker Rules
1. **One process per container** — don't run multiple services in one container
2. **Use multi-stage builds** — separate build and runtime stages
3. **Never use :latest in production** — always pin versions with tags
4. **Always have a .dockerignore** — exclude everything not needed for build
5. **Layer ordering matters** — put rarely-changing layers first for cache efficiency
6. **Use HEALTHCHECK** — every production container needs a health check
7. **Non-root user** — always switch to non-root before CMD
8. **Use COPY, not ADD** — ADD has extra features you probably don't need
9. **Combine RUN commands** — fewer layers = smaller image
10. **Always set resource limits** — in compose or K8s, never unlimited

## Quick Reference Commands
```bash
# Build
docker build -t myapp:1.0.0 .
docker build -t myapp:1.0.0 -f docker/Dockerfile .

# Run
docker run -d --name myapp -p 8000:8000 --env-file .env myapp:1.0.0

# Debug
docker logs myapp --tail 100 -f
docker exec -it myapp /bin/sh
docker inspect myapp

# Cleanup
docker system prune -a --volumes    # Nuclear option — removes everything unused
docker image prune -a               # Remove unused images only
docker volume prune                 # Remove unused volumes only

# Registry
docker tag myapp:1.0.0 registry.example.com/myapp:1.0.0
docker push registry.example.com/myapp:1.0.0
```

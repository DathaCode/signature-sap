---
name: self-healing
description: Error recovery loop — diagnose root cause, avoid repeating the same fix, escalate after 2-3 failed attempts. Read when a command fails, a test breaks, the user corrects an approach, or the same error recurs.
applies-to: signature-sap
---

# Self-Healing Skill — Signature Shades

## Project Context (known recurring pitfalls)
Before troubleshooting, check whether the failure matches one of these (already documented in CLAUDE.md / MEMORY.md):
- **Logger import** must be `import { logger } from '...'` (named, not default)
- **British spelling:** `fabricColour`, `bottomRailColour` — `Color` will fail Prisma queries
- **bcryptjs** version pinned to `^2.4.3` — do NOT bump to v3
- **pdfkit / new npm package** must be installed *inside* the Docker container (anonymous volume for `node_modules`)
- **Prisma type errors** after schema change → run `npm run prisma:generate` (or `docker exec signatureshades-api-local npm run prisma:generate`)
- **Drop addition is +200mm** (not +150mm — older code/comments may say 150)
- **Production commands** must use `-f docker-compose.prod.yml` (per [feedback_prod_compose.md](C:\Users\vdula\.claude\projects\f--SIGNATUR-SHADES-signature-sap\memory\feedback_prod_compose.md))
- **Inventory key format:** `"Material - FabricType"` (3 dash-separated parts including colour) — missing middle part is the most common bug

## When to Activate
- A `docker-compose`, `npm`, `prisma`, or `tsc` command fails
- A test or build breaks
- User says "that's wrong" / "no" / "broken" / corrects an approach
- The same class of error repeats within a session

## Sub-Skills
| File | When to Read |
|------|-------------|
| `pattern-recognition.md` | After any error — identify if this is a known pattern |
| `memory-management.md` | To track what worked and what didn't across the session |
| `skill-creation-guide.md` | When a new pattern emerges that should be documented |

## Core Self-Healing Loop
```
1. ERROR OCCURS
   ↓
2. IDENTIFY — What exactly failed? Read the full error message.
   ↓
3. CATEGORIZE — Is this a known pattern? Check pattern-recognition.md
   ↓
4. DIAGNOSE — Root cause, not symptoms. Don't just retry the same thing.
   ↓
5. FIX — Apply the correct fix based on diagnosis
   ↓
6. VERIFY — Run the command/test again to confirm the fix works
   ↓
7. DOCUMENT — If this is a new pattern, note it for future reference
   ↓
8. PREVENT — Update the approach to prevent this error class entirely
```

## Anti-Patterns (Things Claude Must NEVER Do)
1. **Never retry the exact same command** hoping for a different result
2. **Never ignore error messages** — read them completely
3. **Never apply a fix without understanding the root cause**
4. **Never say "that should work"** without actually testing it
5. **Never blame the environment** before checking the code
6. **Never make multiple changes at once** — fix one thing, test, then next
7. **Never delete and recreate** when a targeted fix is possible

## Escalation Rules
- After 2 failed attempts at the same fix → change approach entirely
- After 3 different approaches fail → stop and explain the problem to the user
- If the error is outside Claude's control (cloud service down, permission issue) → tell the user immediately, don't keep trying

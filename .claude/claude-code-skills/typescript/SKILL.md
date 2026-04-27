---
name: typescript
description: TypeScript work in [frontend/src/](frontend/src/) or [backend/src/](backend/src/) — types, interfaces, Prisma client types, API contracts. Read when defining new types, debugging type errors, or extending API responses.
applies-to: signature-sap
---

# TypeScript Skill — Signature Shades

## Project Context
- **Frontend types:** [frontend/src/types/order.ts](frontend/src/types/order.ts) — mirror backend Prisma schema names exactly (e.g., `fabricColour`, NOT `fabricColor`).
- **Backend types:** Prisma generates types into `node_modules/.prisma/client`. Run `npm run prisma:generate` after every schema change.
- **Shared shape rule:** API request/response types should mirror Prisma model fields. Don't duplicate enums — re-export from `@prisma/client` on backend; redefine identically on frontend.
- **No `any`** — project lints; `unknown` + narrowing or proper interface.
- **British spelling everywhere:** `fabricColour`, `bottomRailColour` (Prisma schema convention).
- **Path aliases:** Frontend uses `@/` for `src/` (Vite). Backend uses relative imports.

## When to Activate
- Writing or editing any `.ts`/`.tsx` file in [frontend/](frontend/) or [backend/](backend/)
- Adding fields to Prisma schema (must update frontend types in lockstep)
- Type errors after pulling new Prisma changes — run `npm run prisma:generate`
- Defining new API response shapes

## Sub-Skills
| File | When to Read |
|------|-------------|
| `type-patterns.md` | Writing types, interfaces, generics, utility types |
| `project-setup.md` | tsconfig, ESLint, path aliases (project tsconfig already configured) |
| `best-practices.md` | Coding standards, anti-patterns, tips |

## Also Read
- `react/SKILL.md` — React-specific patterns
- Backend Prisma docs (`@prisma/client` types are auto-generated)

## Core TypeScript Rules
1. **No `any`** — use `unknown` if type is truly unknown, then narrow
2. **No type assertions** (`as`) unless absolutely necessary — prefer type guards
3. **Always define return types** for exported functions
4. **Use interfaces for objects** — use types for unions, intersections, utilities
5. **Use strict mode** — `"strict": true` in tsconfig
6. **Use `const` assertions** — for literal types and enums
7. **Use discriminated unions** — for state management and error handling
8. **Never use `!`** (non-null assertion) — handle null properly
9. **Use path aliases** — `@/components` instead of `../../../components`
10. **Export types separately** — `export type { User }` for type-only exports

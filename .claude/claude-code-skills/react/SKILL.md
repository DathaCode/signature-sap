---
name: react
description: Frontend work in [frontend/src/](frontend/src/) — React 18 + TypeScript + Vite + TailwindCSS + TanStack Query + React Hook Form. Read when adding pages/components/hooks, touching AuthContext, wiring API calls, or any UI under frontend/.
applies-to: signature-sap
---

# React Skill — Signature Shades

## Project Context (READ FIRST — overrides generic React advice below)
- **Stack:** React 18 + TypeScript + Vite (port 3000) + TailwindCSS + TanStack Query v5 + React Hook Form + react-router-dom + axios
- **State pattern:** TanStack Query (server state) + React Context (auth) + local `useState`/`useReducer`. **No Zustand** — do not introduce it.
- **Auth:** [frontend/src/context/AuthContext.tsx](frontend/src/context/AuthContext.tsx) — JWT in localStorage, role-based (CUSTOMER/ADMIN/WAREHOUSE).
- **API client:** [frontend/src/services/api.ts](frontend/src/services/api.ts) — axios instance with JWT interceptor. Add new endpoints here.
- **Routing convention:** `/new-order` (not `/orders/new`). Role-gated routes wrap `<ProtectedRoute role="ADMIN"|"WAREHOUSE">` in [frontend/src/App.tsx](frontend/src/App.tsx).
- **Page locations:**
  - `pages/auth/` — Login, Register
  - `pages/customer/` — Dashboard, MyOrders
  - `pages/orders/` — NewOrder, OrderDetails
  - `pages/admin/` — OrderManagement, AdminOrderDetails, UserManagement, PricingManagement, InventoryDashboard
  - `pages/warehouse/` — warehouse-only views
- **Reusable UI:** [frontend/src/components/ui/](frontend/src/components/ui/) (Button, Input, Card, etc.) — reuse before creating new.
- **Pricing util:** [frontend/src/utils/pricing.ts](frontend/src/utils/pricing.ts) mirrors backend matrix; rounds to NEAREST tier (backend rounds UP — known divergence, see CLAUDE.md).
- **British spelling required:** `fabricColour`, `bottomRailColour` (NOT `Color`) — Prisma schema uses British spelling.
- **Field name discipline:** when extending forms, mirror Prisma schema names exactly (see [backend/prisma/schema.prisma](backend/prisma/schema.prisma)).

## When to Activate
- Building or editing anything under [frontend/src/](frontend/src/)
- Adding a new page, route, hook, or API call
- Touching auth flow, role gating, or pricing/order forms
- Worksheet preview / cutting-layout UI changes

## Sub-Skills
| File | When to Read |
|------|-------------|
| `component-patterns.md` | Writing or reviewing React components |
| `state-management.md` | Choosing state solutions (defaults to project's TanStack Query + Context pattern) |
| `testing.md` | Writing frontend tests (no test setup yet — manual browser testing per CLAUDE.md) |

## Also Read
- `typescript/SKILL.md` — TypeScript patterns
- `security/web-security.md` — XSS, JWT handling, CORS
- `docker/SKILL.md` — Hot-reload via volume mount; rebuild container after `npm install`

## Core React Rules
1. **Always use TypeScript** — no plain JavaScript for new projects
2. **Always use functional components** — no class components
3. **Use hooks correctly** — follow rules of hooks, proper deps arrays
4. **Keep components small** — max ~150 lines, split when larger
5. **Lift state up only when needed** — keep state as local as possible
6. **Use proper keys** — never use array index as key for dynamic lists
7. **Handle loading and error states** — every async operation needs both
8. **Memoize expensive operations** — useMemo, useCallback when appropriate
9. **Use lazy loading** — React.lazy for route-level code splitting
10. **Accessible by default** — semantic HTML, ARIA labels, keyboard nav

## Project Structure (frontend/)
```
frontend/src/
├── main.tsx                  # Entry — React Query + AuthProvider + Router
├── App.tsx                   # Routes + ProtectedRoute role gates
├── context/
│   └── AuthContext.tsx       # JWT auth, user role
├── pages/
│   ├── auth/                 # Login, Register, ForgotPassword
│   ├── customer/             # Dashboard, MyOrders
│   ├── orders/               # NewOrder, OrderDetails
│   ├── admin/                # OrderManagement, AdminOrderDetails, PricingManagement, InventoryDashboard, UserManagement
│   └── warehouse/            # warehouse-role views
├── components/
│   ├── ui/                   # Button, Input, Card, Modal, Spinner — reuse first
│   ├── layout/               # ProtectedRoute, navbar
│   ├── orders/               # BlindItemForm, CurtainItemForm
│   └── admin/                # FabricCutWorksheet, TubeCutWorksheet, WorksheetPreview
├── services/
│   └── api.ts                # axios + JWT interceptor + endpoint groups (orderApi, pricingApi, inventoryApi, etc.)
├── types/
│   └── order.ts              # Order, OrderItem, Quote types — mirror schema.prisma
├── utils/
│   └── pricing.ts            # Frontend pricing matrix (mirrors backend pricing.service.ts)
└── data/
    ├── sheerFabrics.ts       # Static reference data
    └── sheerHardware.ts
```

## Essential Commands
```bash
# Local dev (preferred — hot-reload via Docker volume)
docker-compose up -d
docker-compose logs -f frontend

# Inside frontend/
npm run dev             # Vite dev server, port 3000
npm run build
npm run lint

# Adding a package (must rebuild — anonymous volume for node_modules)
docker exec signatureshades-web-local npm install <pkg>
# OR rebuild after editing package.json:
docker-compose up -d --build frontend
```

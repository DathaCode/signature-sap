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
  - `pages/auth/` — Login, Register, ForgotPassword, ResetPassword
  - `pages/customer/` — Dashboard, MyOrders
  - `pages/orders/` — NewOrder, OrderDetails
  - `pages/quotes/` — MyQuotes, QuoteDetails
  - `pages/admin/` — OrderManagement, AdminOrderDetails, UserManagement, PricingManagement (incl. BlindFabricsTab), InventoryDashboard, TrashOrders
  - `pages/warehouse/` — warehouse-only views
- **Reusable UI:** [frontend/src/components/ui/](frontend/src/components/ui/) (Button, Input, Card, etc.) — reuse before creating new.
- **Fabric catalog:** [frontend/src/hooks/useFabrics.ts](frontend/src/hooks/useFabrics.ts) — TanStack Query hook that fetches live from `GET /api/blind-fabrics`. Use this in order forms; do NOT import the old static `fabrics.ts`.
- **Curtain form:** [frontend/src/components/orders/CurtainItemForm.tsx](frontend/src/components/orders/CurtainItemForm.tsx) — separate form for sheer curtain items. `NewOrder.tsx` renders either BlindItemForm or CurtainItemForm based on product type.
- **Admin fabric management:** [frontend/src/components/admin/BlindFabricsTab.tsx](frontend/src/components/admin/BlindFabricsTab.tsx) — live inside PricingManagement page. Full CRUD for the BlindFabric catalog.
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
├── hooks/
│   ├── useFabrics.ts         # Fetches BlindFabric catalog from /api/blind-fabrics (TanStack Query)
│   └── useDebounce.ts        # Generic debounce hook
├── pages/
│   ├── auth/                 # Login, Register, ForgotPassword, ResetPassword
│   ├── customer/             # Dashboard, MyOrders
│   ├── orders/               # NewOrder, OrderDetails
│   ├── quotes/               # MyQuotes, QuoteDetails
│   ├── admin/                # OrderManagement, AdminOrderDetails, PricingManagement,
│   │                         # InventoryDashboard, UserManagement, TrashOrders
│   └── warehouse/            # warehouse-role views
├── components/
│   ├── ui/                   # Button, Input, Card, Modal, Spinner — reuse first
│   ├── layout/               # ProtectedRoute, navbar
│   ├── orders/               # BlindItemForm (useFabrics hook), CurtainItemForm
│   ├── inventory/            # AddInventoryModal, AdjustQuantityModal, ItemHistoryModal
│   └── admin/                # FabricCutWorksheet, TubeCutWorksheet, WorksheetPreview,
│                             # CurtainWorksheet, BlindFabricsTab
├── services/
│   └── api.ts                # axios + JWT interceptor + all API groups (orderApi, pricingApi,
│                             # inventoryApi, blindFabricApi, quoteApi, authApi, userApi)
├── types/
│   └── order.ts              # Order, OrderItem, Quote types — mirror schema.prisma
├── utils/
│   └── pricing.ts            # Frontend pricing matrix (mirrors backend pricing.service.ts)
└── data/
    ├── fabrics.ts            # DEPRECATED — static blind fabric data (use useFabrics hook instead)
    ├── hardware.ts           # Blind hardware options
    ├── sheerFabrics.ts       # Sheer curtain fabric options
    └── sheerHardware.ts      # Sheer curtain hardware options
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

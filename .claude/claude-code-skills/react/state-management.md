# React State Management

## Project Decision Tree (Signature Shades)
```
What kind of state is it?
│
├─ Server data (orders, inventory, pricing, users)?
│  → TanStack Query — see frontend/src/services/api.ts for endpoint groups
│
├─ Auth (token, user, role)?
│  → AuthContext (frontend/src/context/AuthContext.tsx) — already wired
│
├─ Other global UI (theme, sidebar)?
│  → React Context. Do NOT add Zustand — not in dependencies, keep stack lean.
│
├─ Form state?
│  → React Hook Form (already used in BlindItemForm, NewOrder)
│
├─ URL state (filters, pagination, tab selection)?
│  → useSearchParams (react-router-dom)
│
└─ Component-local state?
   → useState / useReducer
```

## Zustand — NOT used in this project (skip this section)
The generic Zustand pattern below is reference only. For Signature Shades, prefer Context for global state and TanStack Query for server state.

## Zustand (Generic Reference — not for this project)
```tsx
// stores/authStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  setAuth: (token: string, user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      setAuth: (token, user) => set({ token, user, isAuthenticated: true }),
      logout: () => set({ token: null, user: null, isAuthenticated: false }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ token: state.token }),  // Only persist token
    }
  )
);

// Usage in components:
const { user, isAuthenticated, logout } = useAuthStore();
// Or select specific values (prevents re-renders):
const token = useAuthStore((s) => s.token);
```

```tsx
// stores/uiStore.ts
import { create } from 'zustand';

interface UIState {
  sidebarOpen: boolean;
  theme: 'light' | 'dark';
  toggleSidebar: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  theme: 'light',
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setTheme: (theme) => set({ theme }),
}));
```

## React Query (Server State)
```tsx
// hooks/useUsers.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userService } from '@/services/userService';

// Fetch list
export function useUsers(page: number = 1) {
  return useQuery({
    queryKey: ['users', page],
    queryFn: () => userService.list(page),
    staleTime: 5 * 60 * 1000,
  });
}

// Fetch single
export function useUser(id: number) {
  return useQuery({
    queryKey: ['users', id],
    queryFn: () => userService.getById(id),
    enabled: !!id,    // Don't fetch if no ID
  });
}

// Create with optimistic update
export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: userService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error) => {
      console.error('Failed to create user:', error);
    },
  });
}

// Usage in component
const UsersPage = () => {
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = useUsers(page);
  const createUser = useCreateUser();

  const handleCreate = async (userData: UserCreate) => {
    await createUser.mutateAsync(userData);
  };
};
```

## URL State (Search Params)
```tsx
import { useSearchParams } from 'react-router-dom';

const FilteredList = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get('page')) || 1;
  const search = searchParams.get('q') || '';
  const sort = searchParams.get('sort') || 'created_at';

  const updateFilters = (updates: Record<string, string>) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      Object.entries(updates).forEach(([key, value]) => {
        if (value) next.set(key, value);
        else next.delete(key);
      });
      return next;
    });
  };

  return (
    <div>
      <input
        value={search}
        onChange={(e) => updateFilters({ q: e.target.value, page: '1' })}
        placeholder="Search..."
      />
      {/* URL will be: /items?q=searchterm&page=1&sort=created_at */}
    </div>
  );
};
```

## Context API (Simple Global Values Only)
```tsx
// Only use Context for truly simple, rarely-changing global values
// For anything more complex, use Zustand

import { createContext, useContext, type ReactNode } from 'react';

interface AppConfig {
  apiUrl: string;
  appName: string;
  version: string;
}

const ConfigContext = createContext<AppConfig | null>(null);

export const ConfigProvider = ({ children }: { children: ReactNode }) => {
  const config: AppConfig = {
    apiUrl: import.meta.env.VITE_API_URL,
    appName: import.meta.env.VITE_APP_NAME || 'MyApp',
    version: import.meta.env.VITE_APP_VERSION || '0.0.0',
  };

  return <ConfigContext.Provider value={config}>{children}</ConfigContext.Provider>;
};

export const useConfig = () => {
  const config = useContext(ConfigContext);
  if (!config) throw new Error('useConfig must be used within ConfigProvider');
  return config;
};
```

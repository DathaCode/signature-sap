export type UserRole = 'CUSTOMER' | 'ADMIN';

export interface User {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    phone?: string;
    company?: string;
    address?: string;
    isActive: boolean;
}

export interface AuthResponse {
    success: boolean;
    data: {
        user: User;
        token: string;
    };
}

export interface AuthState {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
}

export interface LoginCredentials {
    email: string;
    password: string;
}

export interface RegisterCredentials {
    name: string;
    email: string;
    password: string;
    phone: string;
    address: string;
    company?: string;
}

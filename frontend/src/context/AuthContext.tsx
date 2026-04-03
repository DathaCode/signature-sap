import React, { createContext, useContext, useEffect, useState } from 'react';
import { AuthState, LoginCredentials, RegisterCredentials } from '../types/auth';
import { authApi } from '../services/api';
import { jwtDecode } from 'jwt-decode';
import { gooeyToast } from 'goey-toast';

interface AuthContextType extends AuthState {
    login: (credentials: LoginCredentials) => Promise<void>;
    register: (credentials: RegisterCredentials) => Promise<{ pendingApproval: boolean }>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, setState] = useState<AuthState>({
        user: null,
        token: localStorage.getItem('token'),
        isAuthenticated: false,
        isLoading: true,
    });

    const clearAuth = () => {
        localStorage.removeItem('token');
        setState({ user: null, token: null, isAuthenticated: false, isLoading: false });
    };

    // Check token on mount
    useEffect(() => {
        const initAuth = async () => {
            const token = localStorage.getItem('token');
            if (token) {
                try {
                    // Check expiration client-side first (avoids unnecessary API call)
                    const decoded: any = jwtDecode(token);
                    const currentTime = Date.now() / 1000;

                    if (decoded.exp < currentTime) {
                        clearAuth();
                        return;
                    }

                    // Verify token is still valid server-side
                    const { user } = await authApi.getCurrentUser();
                    setState({
                        user,
                        token,
                        isAuthenticated: true,
                        isLoading: false,
                    });
                } catch (error: any) {
                    const status = error?.response?.status;
                    if (status === 401 || status === 403) {
                        // Genuine auth failure — token invalid/revoked
                        clearAuth();
                    } else {
                        // Network error, 500, timeout — keep token, don't log out
                        // User can still interact; next request will retry
                        setState(prev => ({ ...prev, isLoading: false }));
                    }
                }
            } else {
                setState(prev => ({ ...prev, isLoading: false }));
            }
        };

        initAuth();

        // Listen for 401s from api interceptor (e.g. mid-session token expiry)
        const handleUnauthorized = () => clearAuth();
        window.addEventListener('auth:unauthorized', handleUnauthorized);
        return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
    }, []);

    const login = async (credentials: LoginCredentials) => {
        try {
            const response = await authApi.login(credentials);
            const { user, token } = response.data;

            localStorage.setItem('token', token);
            setState({
                user,
                token,
                isAuthenticated: true,
                isLoading: false,
            });
            gooeyToast.success('Welcome to Signature Shades, ' + user.name);
        } catch (error: any) {
            const message = error.response?.data?.message || 'Login failed';
            gooeyToast.error(message);
            throw error;
        }
    };

    const register = async (credentials: RegisterCredentials): Promise<{ pendingApproval: boolean }> => {
        try {
            const response = await authApi.register(credentials);
            // New accounts require admin approval — no token issued
            if (response.pendingApproval) {
                return { pendingApproval: true };
            }
            // Fallback: if server ever issues a token (e.g. admin-created accounts)
            if (response.data?.token) {
                const { user, token } = response.data;
                localStorage.setItem('token', token);
                setState({ user, token, isAuthenticated: true, isLoading: false });
                gooeyToast.success('Welcome to Signature Shades!');
            }
            return { pendingApproval: false };
        } catch (error: any) {
            const message = error.response?.data?.message || 'Registration failed';
            gooeyToast.error(message);
            throw error;
        }
    };

    const logout = () => {
        localStorage.removeItem('token');
        setState({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
        });
        authApi.logout().catch(console.error); // Fire and forget
        gooeyToast.success('Logged out successfully');
    };

    return (
        <AuthContext.Provider value={{ ...state, login, register, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

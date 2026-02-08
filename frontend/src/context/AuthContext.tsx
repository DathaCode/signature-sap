import React, { createContext, useContext, useEffect, useState } from 'react';
import { AuthState, LoginCredentials, RegisterCredentials } from '../types/auth';
import { authApi } from '../services/api';
import { jwtDecode } from 'jwt-decode';
import toast from 'react-hot-toast';

interface AuthContextType extends AuthState {
    login: (credentials: LoginCredentials) => Promise<void>;
    register: (credentials: RegisterCredentials) => Promise<void>;
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

    // Check token on mount
    useEffect(() => {
        const initAuth = async () => {
            const token = localStorage.getItem('token');
            if (token) {
                try {
                    // Check expiration
                    const decoded: any = jwtDecode(token);
                    const currentTime = Date.now() / 1000;

                    if (decoded.exp < currentTime) {
                        throw new Error('Token expired');
                    }

                    // Fetch user details
                    const { user } = await authApi.getCurrentUser();
                    setState({
                        user,
                        token,
                        isAuthenticated: true,
                        isLoading: false,
                    });
                } catch (error) {
                    // Invalid token
                    localStorage.removeItem('token');
                    setState({
                        user: null,
                        token: null,
                        isAuthenticated: false,
                        isLoading: false,
                    });
                }
            } else {
                setState(prev => ({ ...prev, isLoading: false }));
            }
        };

        initAuth();
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
            toast.success('Wait for welcome, ' + user.name);
        } catch (error: any) {
            const message = error.response?.data?.message || 'Login failed';
            toast.error(message);
            throw error;
        }
    };

    const register = async (credentials: RegisterCredentials) => {
        try {
            const response = await authApi.register(credentials);
            const { user, token } = response.data;

            localStorage.setItem('token', token);
            setState({
                user,
                token,
                isAuthenticated: true,
                isLoading: false,
            });
            toast.success('Welcome to Signature Shades!');
        } catch (error: any) {
            const message = error.response?.data?.message || 'Registration failed';
            toast.error(message);
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
        toast.success('Logged out successfully');
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

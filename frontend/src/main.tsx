import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './context/AuthContext'
import App from './App'
import './index.css'

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            refetchOnWindowFocus: false,
            retry: 1,
        },
    },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <QueryClientProvider client={queryClient}>
            <BrowserRouter>
                <AuthProvider>
                    <App />
                </AuthProvider>
                <Toaster
                    position="top-right"
                    toastOptions={{
                        duration: 4000,
                        style: {
                            background: '#1B2B3A',
                            color: '#FFFFFF',
                            borderRadius: '10px',
                            border: '1px solid rgba(255,255,255,0.08)',
                            boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
                            padding: '12px 16px',
                            fontSize: '14px',
                        },
                        success: {
                            iconTheme: {
                                primary: '#C9A961',
                                secondary: '#FFFFFF',
                            },
                            style: {
                                border: '1px solid rgba(201,169,97,0.2)',
                            },
                        },
                        error: {
                            iconTheme: {
                                primary: '#EF4444',
                                secondary: '#FFFFFF',
                            },
                            style: {
                                border: '1px solid rgba(239,68,68,0.2)',
                            },
                        },
                    }}
                />
            </BrowserRouter>
        </QueryClientProvider>
    </React.StrictMode>
)

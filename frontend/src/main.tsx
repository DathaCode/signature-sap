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
                        },
                        success: {
                            iconTheme: {
                                primary: '#C9A961',
                                secondary: '#FFFFFF',
                            },
                        },
                    }}
                />
            </BrowserRouter>
        </QueryClientProvider>
    </React.StrictMode>
)

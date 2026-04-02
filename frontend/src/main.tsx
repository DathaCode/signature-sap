import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { GooeyToaster } from 'goey-toast'
import 'goey-toast/styles.css'
import { AuthProvider } from './context/AuthContext'
import App from './App'
import './index.css'

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            refetchOnWindowFocus: false,
            retry: false,
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
                <GooeyToaster
                    position="top-right"
                    theme="dark"
                    duration={4000}
                    gap={14}
                    offset="24px"
                    spring={true}
                    bounce={0.35}
                    closeOnEscape={true}
                    swipeToDismiss={true}
                />
            </BrowserRouter>
        </QueryClientProvider>
    </React.StrictMode>
)

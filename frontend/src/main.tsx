import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import App from './App.tsx'
import './index.css'
import { initSentry, Sentry } from './utils/sentry'

// Initialize Sentry client monitoring
initSentry()

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={<div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center"><h1 className="text-xl font-bold mb-2">Something went wrong</h1><p className="text-sm text-slate-400 mb-4">An unexpected error occurred. Our team has been notified.</p><button onClick={() => window.location.reload()} className="px-4 py-2 bg-blue-600 rounded-lg text-sm font-semibold hover:bg-blue-700">Refresh Page</button></div>}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
          <Toaster position="top-right" richColors />
        </BrowserRouter>
      </QueryClientProvider>
    </Sentry.ErrorBoundary>
  </StrictMode>
)
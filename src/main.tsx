import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, HashRouter } from 'react-router-dom'
import App from './app'
import './styles.css'

const queryClient = new QueryClient()

const router =
	window.location.hostname.endsWith('github.io') ? (
		<HashRouter>
			<App />
		</HashRouter>
	) : (
		<BrowserRouter basename={import.meta.env.BASE_URL}>
			<App />
		</BrowserRouter>
	)

ReactDOM.createRoot(document.getElementById('root')!).render(
	<React.StrictMode>
		<QueryClientProvider client={queryClient}>{router}</QueryClientProvider>
	</React.StrictMode>,
)

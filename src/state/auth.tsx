import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react'
import { demoUsers } from '../data/demo-users'
import { fleetApi, hasFleetApi } from '../services/fleet-api'
import { hasSupabaseAuth, supabaseAuth } from '../services/supabase-auth'
import type { SessionUser } from '../types'

const userStorageKey = 'fleetos.session.user'
const tokenStorageKey = 'fleetos.session.token'

interface AuthState {
	isAuthenticated: boolean
	isAuthenticating: boolean
	isInitializing: boolean
	user: SessionUser | null
	login: (credentials: { email: string; password: string }) => Promise<void>
	logout: () => void
}

const AuthContext = createContext<AuthState | undefined>(undefined)

function readStoredUser() {
	const raw = localStorage.getItem(userStorageKey)
	if (!raw) {
		return null
	}

	try {
		return JSON.parse(raw) as SessionUser
	} catch {
		localStorage.removeItem(userStorageKey)
		return null
	}
}

function clearStoredUser() {
	localStorage.removeItem(userStorageKey)
	localStorage.removeItem(tokenStorageKey)
}

function storeUser(user: SessionUser) {
	localStorage.setItem(userStorageKey, JSON.stringify(user))
}

export function AuthProvider({ children }: { children: ReactNode }) {
	const usesHostedAuth = hasFleetApi() && hasSupabaseAuth()
	const [user, setUser] = useState<SessionUser | null>(() => (usesHostedAuth ? null : readStoredUser()))
	const [isAuthenticating, setIsAuthenticating] = useState(false)
	const [isInitializing, setIsInitializing] = useState(usesHostedAuth)

	useEffect(() => {
		const auth = supabaseAuth
		if (!usesHostedAuth || !auth) {
			setIsInitializing(false)
			return
		}

		let cancelled = false
		const synchronizeSession = async () => {
			const { data } = await auth.auth.getSession()
			if (cancelled) {
				return
			}
			if (!data.session) {
				fleetApi.setToken(null)
				clearStoredUser()
				setUser(null)
				setIsInitializing(false)
				return
			}

			fleetApi.setToken(data.session.access_token)
			localStorage.removeItem(tokenStorageKey)
			try {
				const sessionUser = await fleetApi.me()
				if (!cancelled) {
					storeUser(sessionUser)
					setUser(sessionUser)
				}
			} catch {
				await auth.auth.signOut()
				if (!cancelled) {
					fleetApi.setToken(null)
					clearStoredUser()
					setUser(null)
				}
			} finally {
				if (!cancelled) {
					setIsInitializing(false)
				}
			}
		}

		void synchronizeSession()
		const { data } = auth.auth.onAuthStateChange((_event, session) => {
			fleetApi.setToken(session?.access_token ?? null)
			if (session) {
				localStorage.removeItem(tokenStorageKey)
			} else {
				clearStoredUser()
				setUser(null)
			}
		})

		return () => {
			cancelled = true
			data.subscription.unsubscribe()
		}
	}, [usesHostedAuth])

	const value = useMemo<AuthState>(
		() => ({
			isAuthenticated: Boolean(user),
			isAuthenticating,
			isInitializing,
			user,
			login: async ({ email, password }) => {
				setIsAuthenticating(true)
				try {
					if (hasFleetApi()) {
						const session = await fleetApi.login({
							email: email.trim().toLowerCase(),
							password,
						})
						if (supabaseAuth) {
							if (!session.refreshToken) {
								throw new Error('The API did not return a refreshable Supabase session')
							}
							const { error } = await supabaseAuth.auth.setSession({
								access_token: session.token,
								refresh_token: session.refreshToken,
							})
							if (error) {
								throw error
							}
							localStorage.removeItem(tokenStorageKey)
						} else {
							localStorage.setItem(tokenStorageKey, session.token)
						}
						fleetApi.setToken(session.token)
						storeUser(session.user)
						setUser(session.user)
						return
					}

					const demoUser = demoUsers.find(
						(candidate) => candidate.email === email.trim().toLowerCase() && candidate.password === password,
					)

					if (!demoUser) {
						throw new Error('Invalid email or password')
					}

					const sessionUser: SessionUser = {
						id: demoUser.id,
						name: demoUser.name,
						email: demoUser.email,
						role: demoUser.role,
						companyName: demoUser.companyName,
					}
					storeUser(sessionUser)
					setUser(sessionUser)
				} finally {
					setIsAuthenticating(false)
				}
			},
			logout: () => {
				fleetApi.setToken(null)
				clearStoredUser()
				setUser(null)
				if (supabaseAuth) {
					void supabaseAuth.auth.signOut()
				}
			},
		}),
		[isAuthenticating, isInitializing, user],
	)

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
	const context = useContext(AuthContext)
	if (!context) {
		throw new Error('useAuth must be used inside AuthProvider')
	}
	return context
}

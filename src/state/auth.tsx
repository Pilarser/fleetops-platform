import { createContext, type ReactNode, useContext, useMemo, useState } from 'react'
import { demoUsers } from '../data/demo-users'
import { fleetApi, hasFleetApi } from '../services/fleet-api'
import type { SessionUser } from '../types'

const tokenStorageKey = 'fleetos.session.token'
const userStorageKey = 'fleetos.session.user'

interface AuthState {
	isAuthenticated: boolean
	isAuthenticating: boolean
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

export function AuthProvider({ children }: { children: ReactNode }) {
	const [user, setUser] = useState<SessionUser | null>(() => readStoredUser())
	const [isAuthenticating, setIsAuthenticating] = useState(false)

	const value = useMemo<AuthState>(
		() => ({
			isAuthenticated: Boolean(user),
			isAuthenticating,
			user,
			login: async ({ email, password }) => {
				setIsAuthenticating(true)
				try {
					if (hasFleetApi()) {
						const session = await fleetApi.login({
							email: email.trim().toLowerCase(),
							password,
						})
						fleetApi.setToken(session.token)
						localStorage.setItem(tokenStorageKey, session.token)
						localStorage.setItem(userStorageKey, JSON.stringify(session.user))
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
					localStorage.setItem(tokenStorageKey, 'local-demo-token')
					localStorage.setItem(userStorageKey, JSON.stringify(sessionUser))
					setUser(sessionUser)
				} finally {
					setIsAuthenticating(false)
				}
			},
			logout: () => {
				fleetApi.setToken(null)
				localStorage.removeItem(tokenStorageKey)
				localStorage.removeItem(userStorageKey)
				setUser(null)
			},
		}),
		[isAuthenticating, user],
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

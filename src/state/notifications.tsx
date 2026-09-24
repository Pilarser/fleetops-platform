import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { platformApi, hasPlatformApi } from '../services/platform-api'
import type { Notification } from '../types'

interface NotificationState {
	notifications: Notification[]
	unreadCount: number
	isLoading: boolean
	reload: () => Promise<void>
	markRead: (notificationId: string) => Promise<void>
	markAllRead: () => Promise<void>
}

const NotificationContext = createContext<NotificationState | undefined>(undefined)

export function NotificationProvider({ children }: { children: ReactNode }) {
	const [notifications, setNotifications] = useState<Notification[]>([])
	const [isLoading, setIsLoading] = useState(false)

	const reload = useCallback(async () => {
		if (!hasPlatformApi()) return
		setIsLoading(true)
		try {
			setNotifications(await platformApi.getNotifications())
		} catch {
			// Keep the latest successful notification snapshot during transient API failures.
		} finally {
			setIsLoading(false)
		}
	}, [])

	useEffect(() => {
		void reload()
		const timer = window.setInterval(() => void reload(), 30_000)
		return () => window.clearInterval(timer)
	}, [reload])

	const value = useMemo<NotificationState>(() => ({
		notifications,
		unreadCount: notifications.filter((notification) => !notification.readAt).length,
		isLoading,
		reload,
		markRead: async (notificationId) => {
			const updated = await platformApi.markNotificationRead(notificationId)
			setNotifications((current) => current.map((notification) => notification.id === updated.id ? updated : notification))
		},
		markAllRead: async () => {
			await platformApi.markAllNotificationsRead()
			const readAt = new Date().toISOString()
			setNotifications((current) => current.map((notification) => notification.readAt ? notification : { ...notification, readAt }))
		},
	}), [isLoading, notifications, reload])

	return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
}

export function useNotifications() {
	const context = useContext(NotificationContext)
	if (!context) throw new Error('useNotifications must be used inside NotificationProvider')
	return context
}

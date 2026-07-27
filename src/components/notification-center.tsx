import { Bell, CheckCheck, LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../state/auth'
import { useNotifications } from '../state/notifications'
import type { Notification } from '../types'
import { Button } from './ui'

function relativeTime(value: string) {
	const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000))
	if (minutes < 1) return 'Just now'
	if (minutes < 60) return `${minutes}m ago`
	const hours = Math.floor(minutes / 60)
	if (hours < 24) return `${hours}h ago`
	return new Date(value).toLocaleDateString()
}

export function NotificationCenter() {
	const { user } = useAuth()
	const { isLoading, markAllRead, markRead, notifications, reload, unreadCount } = useNotifications()
	const [isOpen, setIsOpen] = useState(false)
	const navigate = useNavigate()

	async function openNotification(notification: Notification) {
		if (!notification.readAt) await markRead(notification.id)
		setIsOpen(false)
		if (notification.transactionId) {
			navigate(user?.role === 'driver'
				? `/?transaction=${encodeURIComponent(notification.transactionId)}`
				: `/transactions?transaction=${encodeURIComponent(notification.transactionId)}`)
		}
	}

	return (
		<div className="notification-center">
			<button className="icon-button" type="button" aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`} onClick={() => { const next = !isOpen; setIsOpen(next); if (next) void reload() }}>
				<Bell size={19} />
				{unreadCount > 0 ? <span className="notification-count">{unreadCount > 9 ? '9+' : unreadCount}</span> : null}
			</button>
			{isOpen ? (
				<section className="notification-panel" aria-label="Notifications panel">
					<div className="notification-header"><div><strong>Notifications</strong><span>{unreadCount} unread</span></div>{unreadCount > 0 ? <Button type="button" variant="ghost" onClick={() => void markAllRead()}><CheckCheck size={15} /> Mark all read</Button> : null}</div>
					{isLoading && notifications.length === 0 ? <div className="notification-empty"><LoaderCircle className="spinner" size={18} /> Loading</div> : null}
					{!isLoading && notifications.length === 0 ? <div className="notification-empty">No notifications yet.</div> : null}
					<div className="notification-list">
						{notifications.map((notification) => <button key={notification.id} type="button" className={`notification-item${notification.readAt ? '' : ' notification-unread'}`} onClick={() => void openNotification(notification)}><span className="notification-dot" /><span><strong>{notification.title}</strong><small>{notification.message}</small><time>{relativeTime(notification.createdAt)}</time></span></button>)}
					</div>
				</section>
			) : null}
		</div>
	)
}

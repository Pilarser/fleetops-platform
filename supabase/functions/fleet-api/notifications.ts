import { sql } from './db.ts'
import { ApiError } from './http.ts'

type DbNotification = {
	id: string
	transactionId: string | null
	type: string
	title: string
	message: string
	readAt: Date | string | null
	createdAt: Date | string
}

function mapNotification(notification: DbNotification) {
	return {
		...notification,
		readAt: notification.readAt instanceof Date ? notification.readAt.toISOString() : notification.readAt,
		createdAt: notification.createdAt instanceof Date ? notification.createdAt.toISOString() : notification.createdAt,
	}
}

export async function getNotifications(companyId: string, userId: string) {
	const notifications = await sql<DbNotification[]>`
		select id, "transactionId", type, title, message, "readAt", "createdAt"
		from "Notification"
		where "companyId" = ${companyId} and "userId" = ${userId}
		order by "createdAt" desc, id desc
		limit 40
	`
	return notifications.map(mapNotification)
}

export async function markNotificationRead(companyId: string, userId: string, notificationId: string) {
	const [notification] = await sql<DbNotification[]>`
		update "Notification" set "readAt" = coalesce("readAt", now())
		where id = ${notificationId} and "companyId" = ${companyId} and "userId" = ${userId}
		returning id, "transactionId", type, title, message, "readAt", "createdAt"
	`
	if (!notification) throw new ApiError(404, 'Notification not found')
	return mapNotification(notification)
}

export async function markAllNotificationsRead(companyId: string, userId: string) {
	await sql`update "Notification" set "readAt" = now() where "companyId" = ${companyId} and "userId" = ${userId} and "readAt" is null`
	return { ok: true }
}

import { expect, test, type Page } from '@playwright/test'

async function login(page: Page, email: string) {
	await page.goto('./')
	await page.getByLabel('Email').fill(email)
	await page.locator('input[type="password"]').fill('demo1234')
	await page.getByRole('button', { name: 'Sign in' }).click()
}

test('driver submission reaches admin review and returns an approval notification', async ({ page }) => {
	const provider = 'E2E Mobility Provider'

	await login(page, 'driver@example.com')
	await expect(page.getByRole('heading', { name: 'Driver dashboard' })).toBeVisible()
	await page.getByRole('button', { name: 'Submit expense' }).click()
	await page.getByLabel('Provider').fill(provider)
	await page.getByLabel('Amount').fill('42.50')
	await page.getByLabel('VAT').fill('7.50')
	await page.getByRole('button', { name: 'Submit for review' }).click()
	await expect(page.getByRole('status')).toContainText('Expense submitted for review.')
	await page.getByRole('button', { name: 'Logout' }).click()

	await login(page, 'admin@example.com')
	await expect(page.getByRole('heading', { name: 'OneMobility dashboard' })).toBeVisible()
	await page.getByRole('button', { name: /Notifications, 1 unread/ }).click()
	await expect(page.getByText('Expense awaiting review')).toBeVisible()
	await expect(page.getByText('Driver User submitted an expense for review.')).toBeVisible()
	await page.getByText('Expense awaiting review').click()

	const details = page.getByRole('dialog', { name: 'Transaction details' })
	await expect(details).toBeVisible()
	await expect(details).toContainText(provider)
	await details.getByRole('button', { name: 'Approve' }).click()
	await expect(details).toBeHidden()
	await page.getByRole('button', { name: 'Logout' }).click()

	await login(page, 'driver@example.com')
	await page.getByRole('button', { name: /Notifications, 1 unread/ }).click()
	await expect(page.getByText('Expense approved')).toBeVisible()
	await page.getByText('Expense approved').click()

	const approvedDetails = page.getByRole('dialog', { name: 'Transaction details' })
	await expect(approvedDetails).toBeVisible()
	await expect(approvedDetails).toContainText(provider)
	await expect(approvedDetails).toContainText('approved')
})

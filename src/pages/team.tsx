import { type FormEvent, type ReactNode, useEffect, useState } from 'react'
import { LoaderCircle, RotateCw, UserCheck, UserPlus, UserX, XCircle } from 'lucide-react'
import { Badge, Button, Card, Dialog, EmptyState, Field, PageHeader, SelectInput, Table, TextInput } from '../components/ui'
import { fleetApi } from '../services/fleet-api'
import { useAuth } from '../state/auth'
import type { AccountLifecycleAction } from '../types'
import type { TeamMember } from '../types'

type InvitationForm = {
	name: string
	email: string
	role: 'manager' | 'finance' | 'support'
}

const emptyInvitation: InvitationForm = { name: '', email: '', role: 'manager' }

function invitationRedirectUrl() {
	return new URL(import.meta.env.BASE_URL, window.location.origin).toString()
}

export function TeamPage() {
	const { user } = useAuth()
	const [members, setMembers] = useState<TeamMember[]>([])
	const [isLoading, setIsLoading] = useState(true)
	const [loadError, setLoadError] = useState('')
	const [isInviting, setIsInviting] = useState(false)
	const [isDialogOpen, setIsDialogOpen] = useState(false)
	const [form, setForm] = useState<InvitationForm>(emptyInvitation)
	const [inviteError, setInviteError] = useState('')
	const [actionError, setActionError] = useState('')
	const [pendingAction, setPendingAction] = useState<string | null>(null)

	async function loadMembers() {
		setLoadError('')
		try {
			setMembers(await fleetApi.getTeam())
		} catch (error) {
			setLoadError(error instanceof Error ? error.message : 'Unable to load team members')
		} finally {
			setIsLoading(false)
		}
	}

	useEffect(() => {
		void loadMembers()
	}, [])

	async function handleLifecycle(member: TeamMember, action: AccountLifecycleAction) {
		if ((action === 'revoke_invitation' || action === 'disable') && !window.confirm(
			action === 'disable' ? `Disable ${member.name}'s access?` : `Revoke ${member.name}'s invitation?`,
		)) return
		setActionError('')
		setPendingAction(`${member.id}:${action}`)
		try {
			await fleetApi.manageAccount(member.id, action, action === 'resend_invitation' ? invitationRedirectUrl() : undefined)
			await loadMembers()
		} catch (error) {
			setActionError(error instanceof Error ? error.message : 'Unable to update the account')
		} finally {
			setPendingAction(null)
		}
	}

	function openInviteDialog() {
		setForm(emptyInvitation)
		setInviteError('')
		setIsDialogOpen(true)
	}

	async function handleInvite(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()
		setInviteError('')
		setIsInviting(true)
		try {
			const member = await fleetApi.inviteTeamMember({
				...form,
				name: form.name.trim(),
				email: form.email.trim().toLowerCase(),
				redirectUrl: invitationRedirectUrl(),
			})
			setMembers((current) => [...current, member])
			setIsDialogOpen(false)
		} catch (error) {
			setInviteError(error instanceof Error ? error.message : 'Unable to send the invitation')
		} finally {
			setIsInviting(false)
		}
	}

	return (
		<>
			<PageHeader
				title="Team"
				description="Company members and workspace roles."
				actions={<Button type="button" onClick={openInviteDialog}><UserPlus size={16} /> Invite member</Button>}
			/>
			{actionError ? <p className="page-error" role="alert">{actionError}</p> : null}
			<Card>
				{isLoading ? (
					<div className="empty-state" role="status"><LoaderCircle className="spinner" size={22} /><span>Loading team</span></div>
				) : loadError ? (
					<EmptyState title="Unable to load team" detail={loadError} />
				) : (
					<Table
						columns={['Member', 'Email', 'Role', 'Status', 'Actions']}
						rows={members}
						renderRow={(member) => (
							<tr key={member.id}>
								<td><strong>{member.name}</strong></td>
								<td>{member.email}</td>
								<td>{member.role.replace('_', ' ')}</td>
								<td><Badge tone={member.status === 'active' ? 'green' : member.status === 'disabled' ? 'red' : 'amber'}>{member.status}</Badge></td>
								<td><AccountActions member={member} currentUserId={user?.id} pendingAction={pendingAction} onAction={handleLifecycle} /></td>
							</tr>
						)}
					/>
				)}
			</Card>

			{isDialogOpen ? (
				<Dialog title="Invite team member" onClose={() => setIsDialogOpen(false)}>
					<form className="form-grid" onSubmit={handleInvite}>
						<Field label="Name">
							<TextInput required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
						</Field>
						<Field label="Email">
							<TextInput required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
						</Field>
						<Field label="Role">
							<SelectInput value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as InvitationForm['role'] })}>
								<option value="manager">Manager</option>
								<option value="finance">Finance</option>
								<option value="support">Support</option>
							</SelectInput>
						</Field>
						{inviteError ? <p className="form-error">{inviteError}</p> : null}
						<div className="form-actions">
							<Button type="button" variant="secondary" disabled={isInviting} onClick={() => setIsDialogOpen(false)}>Cancel</Button>
							<Button type="submit" disabled={isInviting}>
								{isInviting ? <LoaderCircle className="spinner" size={16} /> : <UserPlus size={16} />}
								{isInviting ? 'Sending...' : 'Send invitation'}
							</Button>
						</div>
					</form>
				</Dialog>
			) : null}
		</>
	)
}

function AccountActions({ member, currentUserId, onAction, pendingAction }: {
	member: TeamMember
	currentUserId?: string
	onAction: (member: TeamMember, action: AccountLifecycleAction) => Promise<void>
	pendingAction: string | null
}) {
	const actionButton = (action: AccountLifecycleAction, label: string, icon: ReactNode) => (
		<Button key={action} type="button" variant="ghost" disabled={Boolean(pendingAction)} onClick={() => void onAction(member, action)}>
			{pendingAction === `${member.id}:${action}` ? <LoaderCircle className="spinner" size={15} /> : icon}{label}
		</Button>
	)
	return (
		<div className="row-actions">
			{member.status === 'invited' ? actionButton('resend_invitation', 'Resend', <RotateCw size={15} />) : null}
			{member.status === 'invited' ? actionButton('revoke_invitation', 'Revoke', <XCircle size={15} />) : null}
			{member.status === 'active' && member.id !== currentUserId ? actionButton('disable', 'Disable', <UserX size={15} />) : null}
			{member.status === 'disabled' ? actionButton('reactivate', 'Reactivate', <UserCheck size={15} />) : null}
		</div>
	)
}

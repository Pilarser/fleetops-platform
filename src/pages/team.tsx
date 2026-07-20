import { type FormEvent, useEffect, useState } from 'react'
import { LoaderCircle, UserPlus } from 'lucide-react'
import { Badge, Button, Card, Dialog, EmptyState, Field, PageHeader, SelectInput, Table, TextInput } from '../components/ui'
import { fleetApi } from '../services/fleet-api'
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
	const [members, setMembers] = useState<TeamMember[]>([])
	const [isLoading, setIsLoading] = useState(true)
	const [loadError, setLoadError] = useState('')
	const [isInviting, setIsInviting] = useState(false)
	const [isDialogOpen, setIsDialogOpen] = useState(false)
	const [form, setForm] = useState<InvitationForm>(emptyInvitation)
	const [inviteError, setInviteError] = useState('')

	useEffect(() => {
		fleetApi.getTeam()
			.then(setMembers)
			.catch((error) => setLoadError(error instanceof Error ? error.message : 'Unable to load team members'))
			.finally(() => setIsLoading(false))
	}, [])

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
			<Card>
				{isLoading ? (
					<div className="empty-state" role="status"><LoaderCircle className="spinner" size={22} /><span>Loading team</span></div>
				) : loadError ? (
					<EmptyState title="Unable to load team" detail={loadError} />
				) : (
					<Table
						columns={['Member', 'Email', 'Role', 'Status']}
						rows={members}
						renderRow={(member) => (
							<tr key={member.id}>
								<td><strong>{member.name}</strong></td>
								<td>{member.email}</td>
								<td>{member.role.replace('_', ' ')}</td>
								<td><Badge tone={member.status === 'active' ? 'green' : 'amber'}>{member.status}</Badge></td>
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

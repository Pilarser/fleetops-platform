import { type FormEvent, useState } from 'react'
import { Eye, EyeOff, LoaderCircle } from 'lucide-react'
import { Button, Card, Field, TextInput } from '../components/ui'
import { useAuth } from '../state/auth'

export function SetPasswordPage() {
	const { completeInvitation, user } = useAuth()
	const [password, setPassword] = useState('')
	const [confirmation, setConfirmation] = useState('')
	const [isVisible, setIsVisible] = useState(false)
	const [isSaving, setIsSaving] = useState(false)
	const [error, setError] = useState('')

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()
		setError('')
		if (password.length < 8) {
			setError('Password must contain at least 8 characters.')
			return
		}
		if (password !== confirmation) {
			setError('Passwords do not match.')
			return
		}

		setIsSaving(true)
		try {
			await completeInvitation(password)
		} catch (saveError) {
			setError(saveError instanceof Error ? saveError.message : 'Unable to complete the invitation')
			setIsSaving(false)
		}
	}

	return (
		<main className="login-shell">
			<Card className="login-card">
				<div className="brand login-brand">
					<div className="brand-mark">FO</div>
					<div>
						<strong>FleetOS</strong>
						<span>{user?.companyName}</span>
					</div>
				</div>
				<div className="login-copy">
					<h1>Set your password</h1>
					<p>Complete your account for {user?.email}.</p>
				</div>
				<form className="login-form" onSubmit={handleSubmit}>
					<Field label="Password">
						<div className="password-field">
							<TextInput required minLength={8} type={isVisible ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} />
							<button aria-label={isVisible ? 'Hide password' : 'Show password'} className="password-toggle" type="button" onClick={() => setIsVisible((current) => !current)}>
								{isVisible ? <EyeOff size={18} /> : <Eye size={18} />}
							</button>
						</div>
					</Field>
					<Field label="Confirm password">
						<TextInput required minLength={8} type={isVisible ? 'text' : 'password'} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
					</Field>
					{error ? <p className="form-error">{error}</p> : null}
					<Button type="submit" disabled={isSaving}>
						{isSaving ? <LoaderCircle className="spinner" size={16} /> : null}
						{isSaving ? 'Completing...' : 'Complete account'}
					</Button>
				</form>
			</Card>
		</main>
	)
}

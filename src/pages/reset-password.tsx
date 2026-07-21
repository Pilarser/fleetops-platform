import { type FormEvent, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Button, Card, Field, TextInput } from '../components/ui'
import { useAuth } from '../state/auth'

export function ResetPasswordPage() {
	const { completePasswordReset } = useAuth()
	const [password, setPassword] = useState('')
	const [confirmation, setConfirmation] = useState('')
	const [error, setError] = useState('')
	const [isSaving, setIsSaving] = useState(false)
	const [isVisible, setIsVisible] = useState(false)

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()
		setError('')
		if (password.length < 8) return setError('Password must contain at least 8 characters')
		if (password !== confirmation) return setError('Passwords do not match')
		setIsSaving(true)
		try {
			await completePasswordReset(password)
		} catch (saveError) {
			setError(saveError instanceof Error ? saveError.message : 'Unable to update the password')
		} finally {
			setIsSaving(false)
		}
	}

	return (
		<main className="login-shell">
			<Card className="login-card">
				<div className="brand login-brand"><div className="brand-mark">FO</div><div><strong>FleetOS</strong><span>Mobility control</span></div></div>
				<div className="login-copy"><h1>Choose a new password</h1><p>Use at least 8 characters.</p></div>
				<form className="login-form" onSubmit={handleSubmit}>
					<Field label="New password">
						<div className="password-field">
							<TextInput autoComplete="new-password" minLength={8} required type={isVisible ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} />
							<button aria-label={isVisible ? 'Hide password' : 'Show password'} className="password-toggle" type="button" onClick={() => setIsVisible((current) => !current)}>{isVisible ? <EyeOff size={18} /> : <Eye size={18} />}</button>
						</div>
					</Field>
					<Field label="Confirm password"><TextInput autoComplete="new-password" minLength={8} required type={isVisible ? 'text' : 'password'} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></Field>
					{error ? <p className="form-error">{error}</p> : null}
					<Button type="submit" disabled={isSaving}>{isSaving ? 'Updating...' : 'Update password'}</Button>
				</form>
			</Card>
		</main>
	)
}

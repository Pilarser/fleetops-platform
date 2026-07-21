import { type FormEvent, useState } from 'react'
import { ArrowLeft, Mail } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button, Card, Field, TextInput } from '../components/ui'
import { useAuth } from '../state/auth'

export function ForgotPasswordPage() {
	const { requestPasswordReset } = useAuth()
	const [email, setEmail] = useState('')
	const [error, setError] = useState('')
	const [isSending, setIsSending] = useState(false)
	const [isSent, setIsSent] = useState(false)

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()
		setError('')
		setIsSending(true)
		try {
			await requestPasswordReset(email)
			setIsSent(true)
		} catch (requestError) {
			setError(requestError instanceof Error ? requestError.message : 'Unable to send the reset email')
		} finally {
			setIsSending(false)
		}
	}

	return (
		<main className="login-shell">
			<Card className="login-card">
				<div className="brand login-brand">
					<div className="brand-mark">FO</div>
					<div><strong>FleetOS</strong><span>Mobility control</span></div>
				</div>
				<div className="login-copy">
					<h1>Reset password</h1>
					<p>{isSent ? 'Check your inbox for a secure password reset link.' : 'Enter the email address associated with your account.'}</p>
				</div>
				{isSent ? (
					<div className="auth-confirmation" role="status"><Mail size={20} /><span>If an account exists for {email.trim().toLowerCase()}, a reset email has been sent.</span></div>
				) : (
					<form className="login-form" onSubmit={handleSubmit}>
						<Field label="Email">
							<TextInput autoComplete="email" required type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
						</Field>
						{error ? <p className="form-error">{error}</p> : null}
						<Button type="submit" disabled={isSending}>{isSending ? 'Sending...' : 'Send reset link'}</Button>
					</form>
				)}
				<p className="auth-switch"><Link to="/"><ArrowLeft size={14} /> Back to sign in</Link></p>
			</Card>
		</main>
	)
}

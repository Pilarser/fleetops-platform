import { type FormEvent, useState } from 'react'
import { Eye, EyeOff, MailCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button, Card, Field, TextInput } from '../components/ui'
import { useAuth } from '../state/auth'

export function RegisterPage() {
	const { isRegistering, registerCompany, resendVerification } = useAuth()
	const [adminName, setAdminName] = useState('')
	const [companyName, setCompanyName] = useState('')
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [passwordConfirmation, setPasswordConfirmation] = useState('')
	const [termsAccepted, setTermsAccepted] = useState(false)
	const [isPasswordVisible, setIsPasswordVisible] = useState(false)
	const [isVerificationPending, setIsVerificationPending] = useState(false)
	const [error, setError] = useState('')
	const [resendMessage, setResendMessage] = useState('')
	const [isResending, setIsResending] = useState(false)

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()
		setError('')

		if (password.length < 8) {
			setError('Password must contain at least 8 characters')
			return
		}
		if (password !== passwordConfirmation) {
			setError('Passwords do not match')
			return
		}
		if (!termsAccepted) {
			setError('Accept the terms and privacy policy to continue')
			return
		}

		try {
			const result = await registerCompany({ adminName, companyName, email, password })
			setIsVerificationPending(result.requiresEmailVerification)
		} catch (registrationError) {
			setError(registrationError instanceof Error ? registrationError.message : 'Unable to create company account')
		}
	}

	async function handleResend() {
		setError('')
		setResendMessage('')
		setIsResending(true)
		try {
			await resendVerification(email)
			setResendMessage('Verification email sent again.')
		} catch (resendError) {
			setError(resendError instanceof Error ? resendError.message : 'Unable to resend verification email')
		} finally {
			setIsResending(false)
		}
	}

	return (
		<main className="login-shell">
			<Card className="login-card registration-card">
				<div className="brand login-brand">
					<div className="brand-mark">FO</div>
					<div>
						<strong>FleetOS</strong>
						<span>Mobility control</span>
					</div>
				</div>

				{isVerificationPending ? (
					<div className="verification-state" role="status">
						<MailCheck size={34} />
						<h1>Verify your email</h1>
						<p>
							We sent a confirmation link to <strong>{email}</strong>. Your company workspace will be created after
							verification.
						</p>
						{error ? <p className="form-error">{error}</p> : null}
						{resendMessage ? <p className="form-success">{resendMessage}</p> : null}
						<div className="verification-actions">
							<Button type="button" variant="secondary" disabled={isResending} onClick={() => void handleResend()}>
								{isResending ? 'Sending...' : 'Resend email'}
							</Button>
							<Link className="auth-link" to="/">
								Back to sign in
							</Link>
						</div>
					</div>
				) : (
					<>
						<div className="login-copy">
							<h1>Create company</h1>
							<p>Set up the first administrator account for your fleet workspace.</p>
						</div>
						<form className="login-form" onSubmit={handleSubmit}>
							<div className="registration-grid">
								<Field label="Administrator name">
									<TextInput required autoComplete="name" value={adminName} onChange={(event) => setAdminName(event.target.value)} />
								</Field>
								<Field label="Company name">
									<TextInput required autoComplete="organization" value={companyName} onChange={(event) => setCompanyName(event.target.value)} />
								</Field>
							</div>
							<Field label="Work email">
								<TextInput required autoComplete="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
							</Field>
							<Field label="Password">
								<div className="password-field">
									<TextInput
										required
										autoComplete="new-password"
										minLength={8}
										type={isPasswordVisible ? 'text' : 'password'}
										value={password}
										onChange={(event) => setPassword(event.target.value)}
									/>
									<button
										aria-label={isPasswordVisible ? 'Hide password' : 'Show password'}
										className="password-toggle"
										type="button"
										onClick={() => setIsPasswordVisible((current) => !current)}
									>
										{isPasswordVisible ? <EyeOff size={18} /> : <Eye size={18} />}
									</button>
								</div>
							</Field>
							<Field label="Confirm password">
								<TextInput
									required
									autoComplete="new-password"
									minLength={8}
									type={isPasswordVisible ? 'text' : 'password'}
									value={passwordConfirmation}
									onChange={(event) => setPasswordConfirmation(event.target.value)}
								/>
							</Field>
							<label className="checkbox-field">
								<input required type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} />
								<span>I accept the terms of service and privacy policy.</span>
							</label>
							{error ? <p className="form-error">{error}</p> : null}
							<Button type="submit" disabled={isRegistering}>
								{isRegistering ? 'Creating account...' : 'Create company account'}
							</Button>
						</form>
						<p className="auth-switch">
							Already have an account? <Link to="/">Sign in</Link>
						</p>
					</>
				)}
			</Card>
		</main>
	)
}

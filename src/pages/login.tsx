import { FormEvent, useState } from 'react'
import { Eye, EyeOff, Info } from 'lucide-react'
import { Button, Card, Dialog, Field, TextInput } from '../components/ui'
import { useAuth } from '../state/auth'

export function LoginPage() {
	const { isAuthenticating, login } = useAuth()
	const [email, setEmail] = useState('admin@example.com')
	const [password, setPassword] = useState('demo1234')
	const [error, setError] = useState('')
	const [isPasswordVisible, setIsPasswordVisible] = useState(false)
	const [isInfoOpen, setIsInfoOpen] = useState(false)

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()
		setError('')

		try {
			await login({ email, password })
		} catch (loginError) {
			setError(loginError instanceof Error ? loginError.message : 'Unable to sign in')
		}
	}

	return (
		<main className="login-shell">
			<Card className="login-card">
				<div className="brand login-brand">
					<div className="brand-mark">FO</div>
					<div>
						<strong>FleetOS</strong>
						<span>Mobility control</span>
					</div>
				</div>
				<div className="login-copy">
					<div className="login-title-row">
						<h1>Sign in</h1>
						<button
							aria-label="Show demo accounts"
							className="icon-button"
							type="button"
							onClick={() => setIsInfoOpen(true)}
						>
							<Info size={18} />
						</button>
					</div>
					<p>Use a demo account to access the fleet operations workspace.</p>
				</div>
				<form className="login-form" onSubmit={handleSubmit}>
					<Field label="Email">
						<TextInput required type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
					</Field>
					<Field label="Password">
						<div className="password-field">
							<TextInput
								required
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
					{error ? <p className="form-error">{error}</p> : null}
					<Button type="submit" disabled={isAuthenticating}>
						{isAuthenticating ? 'Signing in...' : 'Sign in'}
					</Button>
				</form>
			</Card>

			{isInfoOpen ? (
				<Dialog title="Demo accounts" onClose={() => setIsInfoOpen(false)}>
					<div className="demo-credentials demo-credentials-modal">
						<span>admin@example.com / demo1234</span>
						<span>finance@example.com / demo1234</span>
						<span>driver@example.com / demo1234</span>
					</div>
				</Dialog>
			) : null}
		</main>
	)
}

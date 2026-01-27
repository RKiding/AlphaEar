import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Loader2, Lock, User, Key } from 'lucide-react'
import './Auth.css'

const API_BASE = import.meta.env.DEV ? 'http://localhost:8765' : ''

export function Register() {
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [invitationCode, setInvitationCode] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState(false)

    const navigate = useNavigate()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError('')

        try {
            const res = await fetch(`${API_BASE}/api/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username,
                    password,
                    invitation_code: invitationCode
                })
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.detail || 'Registration failed')
            }

            setSuccess(true)
            setTimeout(() => {
                navigate('/login')
            }, 1500)

        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="auth-container">
            <div className="auth-card">
                <div className="auth-title">Create Account</div>
                <div className="auth-subtitle">Join AlphaEar with an invitation code</div>

                {error && <div className="error-message">{error}</div>}
                {success && <div className="error-message" style={{ background: 'var(--success-bg)', color: 'var(--success)', borderColor: 'var(--success)' }}>Registration Successful! Redirecting...</div>}

                <form className="auth-form" onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label">Username</label>
                        <div style={{ position: 'relative' }}>
                            <input
                                className="form-input"
                                style={{ paddingLeft: '36px' }}
                                type="text"
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                required
                                placeholder="Choose a username"
                            />
                            <User size={16} style={{ position: 'absolute', left: '10px', top: '12px', color: 'var(--text-muted)' }} />
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Password</label>
                        <div style={{ position: 'relative' }}>
                            <input
                                className="form-input"
                                style={{ paddingLeft: '36px' }}
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                required
                                placeholder="Choose a password"
                            />
                            <Lock size={16} style={{ position: 'absolute', left: '10px', top: '12px', color: 'var(--text-muted)' }} />
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Invitation Code</label>
                        <div style={{ position: 'relative' }}>
                            <input
                                className="form-input"
                                style={{ paddingLeft: '36px' }}
                                type="text"
                                value={invitationCode}
                                onChange={e => setInvitationCode(e.target.value)}
                                required
                                placeholder="Enter invitation code"
                            />
                            <Key size={16} style={{ position: 'absolute', left: '10px', top: '12px', color: 'var(--text-muted)' }} />
                        </div>
                    </div>

                    <button type="submit" className="auth-btn" disabled={loading || success}>
                        {loading ? (
                            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                <Loader2 className="spin" size={16} /> Registering...
                            </span>
                        ) : 'Sign Up'}
                    </button>
                </form>

                <div className="auth-footer">
                    Already have an account?
                    <Link to="/login" className="auth-link">Sign in</Link>
                </div>
            </div>
        </div>
    )
}

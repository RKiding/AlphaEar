import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useDashboardStore } from '../../store'
import { Loader2, Lock, User } from 'lucide-react'
import './Auth.css'

const API_BASE = import.meta.env.DEV ? 'http://localhost:8765' : ''

export function Login() {
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const navigate = useNavigate()
    const login = useDashboardStore(state => state.login)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError('')

        try {
            const res = await fetch(`${API_BASE}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.detail || 'Login failed')
            }

            // Decode token to get user id (or fetch /me)
            // Ideally backend returns user info with token or we fetch /me
            // Simple decode for now or just fetch /me
            const token = data.access_token

            // Allow time for token to propagate or fetch me
            const meRes = await fetch(`${API_BASE}/api/auth/me`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })

            if (meRes.ok) {
                const user = await meRes.json()
                login(user, token)
                navigate('/')
            } else {
                throw new Error('Failed to fetch user profile')
            }

        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="auth-container">
            <div className="auth-card">
                <div className="auth-title">AlphaEar</div>
                <div className="auth-subtitle">Sign in to your account</div>

                {error && <div className="error-message">{error}</div>}

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
                                placeholder="Enter your username"
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
                                placeholder="Enter your password"
                            />
                            <Lock size={16} style={{ position: 'absolute', left: '10px', top: '12px', color: 'var(--text-muted)' }} />
                        </div>
                    </div>

                    <button type="submit" className="auth-btn" disabled={loading}>
                        {loading ? (
                            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                <Loader2 className="spin" size={16} /> Signing in...
                            </span>
                        ) : 'Sign In'}
                    </button>
                </form>

                <div className="auth-footer">
                    Don't have an account?
                    <Link to="/register" className="auth-link">Sign up</Link>
                </div>
            </div>
        </div>
    )
}

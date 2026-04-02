import { useState } from 'react'
import { loginPublicCustomer, registerPublicCustomer } from '../api/client'

export function CustomerAuthScreen() {
  const [mode, setMode] = useState('login')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [loginValue, setLoginValue] = useState('')

  const goCheckout = () => {
    if (typeof window === 'undefined') return
    window.location.assign('/cart')
  }

  const handleRegister = async (event) => {
    event.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError('')
    try {
      await registerPublicCustomer({
        fullName,
        email,
        phone,
        password,
      })
      goCheckout()
    } catch (requestError) {
      setError(String(requestError?.message || 'Unable to register customer account.'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleLogin = async (event) => {
    event.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError('')
    try {
      await loginPublicCustomer({
        login: loginValue,
        password,
      })
      goCheckout()
    } catch (requestError) {
      setError(String(requestError?.message || 'Unable to login customer account.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto w-full max-w-md">
        <a href="/" className="text-sm font-semibold text-[#2D71F8] hover:text-[#235ED3]">
          Back to Website
        </a>
        <section className="ui-modal-card mt-3 rounded-2xl p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Customer Account</p>
          <h1 className="mt-2 text-2xl font-black text-slate-900">Login or Register</h1>
          <p className="mt-1 text-sm text-slate-500">Use phone number or Gmail to continue checkout.</p>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              className={`ui-btn py-2 text-sm ${mode === 'login' ? 'ui-btn-primary' : 'ui-btn-secondary'}`}
              onClick={() => {
                setMode('login')
                setError('')
              }}
            >
              Login
            </button>
            <button
              type="button"
              className={`ui-btn py-2 text-sm ${mode === 'register' ? 'ui-btn-primary' : 'ui-btn-secondary'}`}
              onClick={() => {
                setMode('register')
                setError('')
              }}
            >
              Register
            </button>
          </div>

          {mode === 'register' ? (
            <form className="mt-4 space-y-3" onSubmit={handleRegister}>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Full Name</span>
                <input
                  className="ui-input px-3 py-2.5 text-sm"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Your name"
                  required
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Gmail (optional)</span>
                <input
                  className="ui-input px-3 py-2.5 text-sm"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="your@gmail.com"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Phone (optional)</span>
                <input
                  className="ui-input px-3 py-2.5 text-sm"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="012345678"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Password</span>
                <input
                  className="ui-input px-3 py-2.5 text-sm"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="At least 6 characters"
                  required
                  minLength={6}
                />
              </label>
              {error && <p className="text-sm font-semibold text-red-500">{error}</p>}
              <button type="submit" className="ui-btn ui-btn-primary w-full py-2.5 text-sm" disabled={submitting}>
                {submitting ? 'Registering...' : 'Register and Continue'}
              </button>
            </form>
          ) : (
            <form className="mt-4 space-y-3" onSubmit={handleLogin}>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Phone or Gmail</span>
                <input
                  className="ui-input px-3 py-2.5 text-sm"
                  value={loginValue}
                  onChange={(event) => setLoginValue(event.target.value)}
                  placeholder="Phone or Gmail"
                  required
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Password</span>
                <input
                  className="ui-input px-3 py-2.5 text-sm"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Password"
                  required
                />
              </label>
              {error && <p className="text-sm font-semibold text-red-500">{error}</p>}
              <button type="submit" className="ui-btn ui-btn-primary w-full py-2.5 text-sm" disabled={submitting}>
                {submitting ? 'Logging in...' : 'Login and Continue'}
              </button>
            </form>
          )}
        </section>
      </div>
    </div>
  )
}

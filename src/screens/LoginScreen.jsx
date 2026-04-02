import { Coffee, LockKeyhole, UserRound } from 'lucide-react'
import { useState } from 'react'

export function LoginScreen({ loading = false, error = '', onSubmit }) {
  const [username, setUsername] = useState('cashier')
  const [password, setPassword] = useState('cashier123')

  const submitForm = async (event) => {
    event.preventDefault()
    if (loading) return
    await onSubmit?.({ username: username.trim(), password })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#eaf2ff_0%,#f7faff_38%,#ffffff_78%)] p-4">
      <section className="ui-surface w-full max-w-[420px] rounded-3xl border-slate-200 p-6 md:p-7">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#2D71F8]/10 text-[#2D71F8]">
            <Coffee size={20} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Coffee POS</h1>
            <p className="text-xs text-slate-500">Secure Staff Login</p>
          </div>
        </div>

        <form onSubmit={submitForm} className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Username
            </span>
            <span className="relative block">
              <UserRound size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="ui-input py-2.5 pl-9 pr-3 text-sm"
                placeholder="cashier"
                autoComplete="username"
              />
            </span>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Password
            </span>
            <span className="relative block">
              <LockKeyhole size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="ui-input py-2.5 pl-9 pr-3 text-sm"
                placeholder="Enter password"
                autoComplete="current-password"
              />
            </span>
          </label>

          {error && (
            <p className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-semibold text-[#FC4A4A]">
              {error}
            </p>
          )}

          <button type="submit" disabled={loading} className="ui-btn ui-btn-primary w-full py-3 text-sm">
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

      </section>
    </div>
  )
}

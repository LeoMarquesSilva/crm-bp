import { useState } from 'react'
import { LogIn, Eye, EyeOff, User, Lock } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { getExpectedLogin, getExpectedPassword, setAuthenticated } from '@/lib/auth'

interface LoginProps {
  onSuccess: () => void
}

export function Login({ onSuccess }: LoginProps) {
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const expectedLogin = getExpectedLogin()
  const expectedPassword = getExpectedPassword()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const loginTrim = login.trim()
    const passwordTrim = password.trim()
    if (!loginTrim || !passwordTrim) {
      setError('Preencha usuário e senha.')
      return
    }
    setIsSubmitting(true)
    setTimeout(() => {
      if (loginTrim === expectedLogin && passwordTrim === expectedPassword) {
        setAuthenticated()
        onSuccess()
      } else {
        setError('Usuário ou senha incorretos. Tente novamente.')
        setIsSubmitting(false)
      }
    }, 300)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden">
      {/* Imagem 3D do escritório (background) */}
      <div className="absolute inset-0 z-0">
        <img
          src="/escritorio%20dia.png"
          alt=""
          className="absolute inset-0 w-full h-full object-cover object-center scale-105"
          aria-hidden
        />
        {/* Overlay escuro (marca + contraste) */}
        <div
          className="absolute inset-0 z-[1]"
          style={{
            background:
              'linear-gradient(135deg, rgba(16, 31, 46, 0.88) 0%, rgba(16, 31, 46, 0.75) 40%, rgba(2, 14, 23, 0.9) 100%)',
          }}
        />
        {/* Toque dourado sutil (identidade) */}
        <div
          className="absolute inset-0 z-[2] pointer-events-none opacity-30"
          style={{
            background:
              'radial-gradient(ellipse 80% 50% at 20% 50%, rgba(213, 177, 112, 0.12) 0%, transparent 50%)',
          }}
        />
        {/* Grid sutil (tech) */}
        <div
          className="absolute inset-0 z-[2] pointer-events-none opacity-[0.03]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)
            `,
            backgroundSize: '48px 48px',
          }}
        />
      </div>

      <motion.div
        className="w-full max-w-[400px] relative z-10 px-4 py-8"
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        {/* Card único: logo, título e formulário juntos (evita “flutuando”) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] }}
          className={cn(
            'rounded-2xl overflow-hidden shadow-2xl',
            'bg-white/95 backdrop-blur-xl',
            'border border-white/30',
            'ring-1 ring-black/5'
          )}
        >
          {/* Faixa dourada (identidade) */}
          <div className="h-1 w-full bg-gradient-to-r from-sales via-sales-light to-sales" />

          {/* Cabeçalho do card: logo + título + subtítulo */}
          <div className="px-6 sm:px-8 pt-6 pb-4 text-center border-b border-gray-100">
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.35 }}
              className="flex flex-col items-center"
            >
              <img
                src="/logo-azul.png"
                alt="Bismarchi | Pires"
                className="h-14 w-auto object-contain"
              />
              <h1 className="mt-4 text-xl font-semibold text-gray-800 tracking-tight">
                Gestão de Leads
              </h1>
              <p className="mt-1.5 text-sm text-gray-500">
                Acesse com suas credenciais para continuar
              </p>
            </motion.div>
          </div>

          <div className="p-6 sm:p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="login" className="block text-sm font-medium text-gray-700 mb-2">
                  Usuário
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    id="login"
                    type="text"
                    value={login}
                    onChange={(e) => {
                      setLogin(e.target.value)
                      setError('')
                    }}
                    placeholder="Digite seu usuário"
                    autoComplete="username"
                    autoFocus
                    disabled={isSubmitting}
                    className={cn(
                      'w-full rounded-xl border bg-gray-50/90 text-gray-900 placeholder:text-gray-400 pl-10 pr-4 py-3 text-[15px]',
                      'transition-all duration-200',
                      'focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary focus:bg-white',
                      'disabled:opacity-60 disabled:cursor-not-allowed',
                      error ? 'border-red-300 focus:ring-red-200 focus:border-red-400' : 'border-gray-200'
                    )}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  Senha
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      setError('')
                    }}
                    placeholder="Digite sua senha"
                    autoComplete="current-password"
                    disabled={isSubmitting}
                    className={cn(
                      'w-full rounded-xl border bg-gray-50/90 text-gray-900 placeholder:text-gray-400 pl-10 pr-11 py-3 text-[15px]',
                      'transition-all duration-200',
                      'focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary focus:bg-white',
                      'disabled:opacity-60 disabled:cursor-not-allowed',
                      error ? 'border-red-300 focus:ring-red-200 focus:border-red-400' : 'border-gray-200'
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 flex items-center gap-2"
                  role="alert"
                >
                  <span className="flex h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
                  {error}
                </motion.p>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className={cn(
                  'w-full flex items-center justify-center gap-2 rounded-xl py-3.5 px-4 font-semibold text-white text-[15px]',
                  'bg-gradient-to-r from-primary to-primary/90 shadow-lg',
                  'hover:from-primary/95 hover:to-primary/85 hover:shadow-xl hover:shadow-primary/20',
                  'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
                  'active:scale-[0.99] transition-all duration-200',
                  'disabled:opacity-70 disabled:cursor-not-allowed disabled:active:scale-100'
                )}
              >
                {isSubmitting ? (
                  <>
                    <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Entrando...
                  </>
                ) : (
                  <>
                    <LogIn className="h-4 w-4" />
                    Entrar
                  </>
                )}
              </button>
            </form>
          </div>
        </motion.div>

        <p className="mt-6 text-center text-xs text-white/60 drop-shadow-sm">
          Credenciais restritas ao uso interno · Bismarchi | Pires
        </p>
      </motion.div>
    </div>
  )
}

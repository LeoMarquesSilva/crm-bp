import { useState, useEffect } from 'react'
import { Lock, Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'

const STORAGE_KEY = 'crm_protected_ok'

function getExpectedPassword(): string {
  return (import.meta.env.VITE_CRM_PROTECTED_PASSWORD as string) || ''
}

function isUnlocked(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(STORAGE_KEY) === '1'
}

function setUnlocked(): void {
  localStorage.setItem(STORAGE_KEY, '1')
}

interface ProtectedGateProps {
  children: React.ReactNode
  /** Nome da área (ex.: Validação, SLA) para exibir na tela de senha */
  areaName?: string
}

export function ProtectedGate({ children, areaName = 'esta área' }: ProtectedGateProps) {
  const [unlocked, setUnlockedState] = useState(false)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [checkDone, setCheckDone] = useState(false)

  const expected = getExpectedPassword()

  useEffect(() => {
    if (expected === '') {
      // Sem senha configurada: não exige autenticação
      setUnlockedState(true)
    } else {
      setUnlockedState(isUnlocked())
    }
    setCheckDone(true)
  }, [expected])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (expected === '') {
      setUnlockedState(true)
      return
    }
    if (password.trim() === expected) {
      setUnlocked()
      setUnlockedState(true)
      setPassword('')
    } else {
      setError('Senha incorreta. Tente novamente.')
    }
  }

  if (!checkDone) {
    return (
      <div className="flex items-center justify-center min-h-[320px]">
        <div className="animate-pulse flex items-center gap-2 text-gray-500">
          <Lock className="h-5 w-5" />
          <span>Carregando...</span>
        </div>
      </div>
    )
  }

  if (unlocked) {
    return <>{children}</>
  }

  return (
    <div className="flex items-center justify-center min-h-[320px] px-4">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 shadow-lg">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Lock className="h-6 w-6" />
          </div>
          <div className="text-center">
            <h2 className="text-lg font-semibold text-gray-800">Acesso restrito</h2>
            <p className="mt-1 text-sm text-gray-600">
              Digite a senha para acessar {areaName}.
            </p>
          </div>
          <form onSubmit={handleSubmit} className="w-full space-y-3">
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  setError('')
                }}
                placeholder="Senha"
                autoFocus
                className={cn(
                  'w-full rounded-lg border bg-gray-50 px-4 py-2.5 pr-10 text-gray-800',
                  'placeholder:text-gray-400',
                  'focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
                  error ? 'border-red-300' : 'border-gray-300'
                )}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-500 hover:text-gray-700 rounded"
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {error && (
              <p className="text-sm text-red-600" role="alert">
                {error}
              </p>
            )}
            <button
              type="submit"
              className="w-full rounded-lg bg-primary px-4 py-2.5 font-medium text-white hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-colors"
            >
              Entrar
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

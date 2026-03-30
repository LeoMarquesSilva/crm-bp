import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type DashboardSectionProps = {
  /** Ícone (lucide ou elemento) exibido ao lado do título */
  icon: ReactNode
  title: string
  /** Descrição opcional abaixo do título */
  description?: string
  /** Conteúdo da seção */
  children: ReactNode
  /** Classes adicionais no container do card */
  className?: string
  /** Se a seção deve ocupar 2 colunas no grid (xl) */
  fullWidth?: boolean
}

/**
 * Seção de dashboard estilo CRM: card com cabeçalho (ícone + título + descrição) e conteúdo.
 * Use dentro de um grid (ex.: grid-cols-1 xl:grid-cols-2) para layout em 2 colunas.
 */
export function DashboardSection({
  icon,
  title,
  description,
  children,
  className,
  fullWidth,
}: DashboardSectionProps) {
  return (
    <section
      className={cn(
        'rounded-2xl border border-gray-200/80 bg-white/95 p-5 shadow-md backdrop-blur-sm',
        fullWidth && 'xl:col-span-2',
        className
      )}
    >
      <header className="flex items-start gap-3 mb-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          {description && (
            <p className="text-sm text-gray-500 mt-0.5">{description}</p>
          )}
        </div>
      </header>
      <div className="mt-2">{children}</div>
    </section>
  )
}

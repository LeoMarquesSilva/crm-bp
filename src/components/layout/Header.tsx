import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  BarChart3,
  ChevronDown,
  Clock,
  ExternalLink,
  FileCheck,
  LogOut,
  Menu,
  MessageCircle,
  Palette,
  X
} from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { clearAuthenticated } from '@/lib/auth'

export function Header() {
  const { pathname } = useLocation()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isDesktopMoreOpen, setIsDesktopMoreOpen] = useState(false)
  const desktopMoreRef = useRef<HTMLDivElement | null>(null)
  const isValidacao = pathname === '/validacao'
  const isSla = pathname === '/sla'
  const isDashboard = pathname === '/analise-planilha'
  const isDueDiligence = pathname === '/due-diligence' || pathname.startsWith('/due-diligence/')
  const isDueDiligenceCharts = pathname === '/due-diligence/graficos'
  const isConfigWpp = pathname === '/config-whatsapp'
  const isSecondaryActive = isConfigWpp || isDueDiligenceCharts

  const primaryLinks = [
    { to: '/validacao', label: 'Validação', isActive: isValidacao, icon: null },
    { to: '/sla', label: 'SLA', isActive: isSla, icon: Clock },
    { to: '/analise-planilha', label: 'Dashboard', isActive: isDashboard, icon: BarChart3 },
    { to: '/due-diligence', label: 'Due Diligence', isActive: isDueDiligence && !isDueDiligenceCharts, icon: FileCheck }
  ]

  const secondaryLinks = [
    { to: '/config-whatsapp', label: 'WhatsApp', isActive: isConfigWpp, icon: MessageCircle },
    {
      to: '/due-diligence/graficos',
      label: 'Gráficos PPT',
      isActive: isDueDiligenceCharts,
      icon: Palette,
      title: 'Estilo e tipo de gráfico globais do PPT'
    }
  ]

  useEffect(() => {
    setIsMobileMenuOpen(false)
    setIsDesktopMoreOpen(false)
  }, [pathname])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!desktopMoreRef.current?.contains(event.target as Node)) {
        setIsDesktopMoreOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const getNavLinkClassName = (isActive: boolean) =>
    `rounded-md border px-3 py-1.5 text-xs font-semibold transition-all duration-200 flex items-center gap-1.5 ${
      isActive
        ? 'text-white bg-white/20 border-white/30'
        : 'text-white/90 hover:text-white bg-white/10 hover:bg-white/20 border-white/20 hover:border-sales/50'
    }`

  return (
    <header
      className="relative border-b border-primary/30 shadow-md overflow-visible sticky top-0 z-30"
      style={{
        background: 'linear-gradient(90deg, rgba(16, 31, 46, 1) 0%, rgba(16, 31, 46, 1) 50%, rgba(2, 14, 23, 1) 100%)'
      }}
    >
      <div className="absolute inset-0 opacity-[0.02]">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 20px, rgba(213, 177, 112, 0.05) 20px, rgba(213, 177, 112, 0.05) 40px)',
            backgroundSize: '40px 40px'
          }}
        />
      </div>

      <div className="relative px-3 sm:px-4 lg:px-6 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <motion.div
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
            className="flex items-center"
          >
            <img
              src="/logo.png"
              alt="Bismarchi | Pires Sociedade de Advogados"
              className="h-9 sm:h-10 lg:h-11 w-auto object-contain transition-transform hover:scale-[1.02] drop-shadow"
            />
          </motion.div>

          <motion.nav
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.3 }}
            className="hidden lg:flex items-center gap-1.5"
          >
            {primaryLinks.map((item) => {
              const Icon = item.icon
              return (
                <Link key={item.to} to={item.to} className={getNavLinkClassName(item.isActive)}>
                  {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
                  {item.label}
                </Link>
              )
            })}
          </motion.nav>

          <motion.div
            className="flex items-center gap-1.5"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div ref={desktopMoreRef} className="relative hidden lg:block">
              <button
                type="button"
                onClick={() => setIsDesktopMoreOpen((prev) => !prev)}
                className={getNavLinkClassName(isSecondaryActive || isDesktopMoreOpen)}
              >
                Mais
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isDesktopMoreOpen ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {isDesktopMoreOpen ? (
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.98 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 z-50 mt-2 w-56 rounded-lg border border-gray-200 bg-white shadow-lg overflow-hidden"
                  >
                    <div className="p-1">
                      {secondaryLinks.map((item) => {
                        const Icon = item.icon
                        return (
                          <Link
                            key={item.to}
                            to={item.to}
                            title={item.title}
                            className={`flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-colors ${
                              item.isActive ? 'bg-primary/10 text-primary' : 'text-gray-700 hover:bg-gray-100'
                            }`}
                          >
                            <Icon className="h-3.5 w-3.5" />
                            {item.label}
                          </Link>
                        )
                      })}
                      <a
                        href="#"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 flex items-center justify-between rounded-md px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                      >
                        <span>RD Station CRM</span>
                        <ExternalLink className="h-3.5 w-3.5 text-gray-500" />
                      </a>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>

            <button
              type="button"
              onClick={() => {
                clearAuthenticated()
                window.location.href = '/'
              }}
              className="hidden lg:flex items-center gap-1.5 rounded-md border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/90 transition-all duration-200 hover:border-white/30 hover:bg-white/20 hover:text-white"
              title="Sair do sistema"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Sair</span>
            </button>

            <button
              type="button"
              onClick={() => setIsMobileMenuOpen((prev) => !prev)}
              className="lg:hidden flex items-center justify-center rounded-md border border-white/20 bg-white/10 p-2 text-white/90 hover:text-white hover:bg-white/20 transition-colors"
              aria-label={isMobileMenuOpen ? 'Fechar menu de navegação' : 'Abrir menu de navegação'}
              aria-expanded={isMobileMenuOpen}
            >
              {isMobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </motion.div>
        </div>

        <AnimatePresence>
          {isMobileMenuOpen ? (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="lg:hidden mt-2 rounded-lg border border-white/20 bg-white/10 backdrop-blur-sm p-2"
            >
              <div className="grid gap-1.5">
                {primaryLinks.map((item) => {
                  const Icon = item.icon
                  return (
                    <Link key={item.to} to={item.to} className={getNavLinkClassName(item.isActive)}>
                      {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
                      {item.label}
                    </Link>
                  )
                })}

                <div className="my-1 h-px bg-white/20" />

                {secondaryLinks.map((item) => {
                  const Icon = item.icon
                  return (
                    <Link key={item.to} to={item.to} title={item.title} className={getNavLinkClassName(item.isActive)}>
                      <Icon className="h-3.5 w-3.5" />
                      {item.label}
                    </Link>
                  )
                })}

                <a
                  href="#"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-md border border-white/20 px-3 py-1.5 text-xs font-semibold text-white/90 transition-all duration-200 hover:text-white bg-white/10 hover:bg-white/20 hover:border-sales/50 flex items-center justify-between"
                >
                  <span>RD Station CRM</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>

                <button
                  type="button"
                  onClick={() => {
                    clearAuthenticated()
                    window.location.href = '/'
                  }}
                  className="rounded-md border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/90 transition-all duration-200 hover:border-white/30 hover:bg-white/20 hover:text-white flex items-center gap-1.5"
                  title="Sair do sistema"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Sair</span>
                </button>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </header>
  )
}

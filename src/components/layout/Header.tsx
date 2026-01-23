import { TrendingUp, ExternalLink } from 'lucide-react'
import { motion } from 'framer-motion'

export function Header() {
  return (
    <header 
      className="relative border-b border-primary/30 shadow-md overflow-hidden sticky top-0 z-10"
      style={{
        background: 'linear-gradient(90deg, rgba(16, 31, 46, 1) 0%, rgba(16, 31, 46, 1) 50%, rgba(2, 14, 23, 1) 100%)'
      }}
    >
      {/* Subtle background pattern */}
      <div className="absolute inset-0 opacity-[0.02]">
        <div 
          className="absolute inset-0"
          style={{
            backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 20px, rgba(213, 177, 112, 0.05) 20px, rgba(213, 177, 112, 0.05) 40px)',
            backgroundSize: '40px 40px'
          }}
        />
      </div>

      <div className="relative px-6 lg:px-8 py-4 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="flex items-center justify-center"
        >
          <img 
            src="/logo.png" 
            alt="Bismarchi | Pires Sociedade de Advogados" 
            className="h-14 lg:h-16 w-auto object-contain transition-transform hover:scale-[1.03] drop-shadow-lg"
          />
        </motion.div>

        {/* RD Station Link - positioned absolutely on the right */}
        <motion.nav 
          className="absolute right-6 lg:right-8 flex items-center"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          <a
            href="#"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-2 px-4 py-2.5 rounded-lg text-white/90 hover:text-white bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 hover:border-sales/50 transition-all duration-300 text-sm font-semibold shadow-sm hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"
          >
            <TrendingUp className="h-4 w-4 text-sales group-hover:scale-110 transition-transform" />
            <span>RD Station CRM</span>
            <ExternalLink className="h-3.5 w-3.5 opacity-70 group-hover:opacity-100 transition-opacity" />
          </a>
        </motion.nav>
      </div>
    </header>
  )
}

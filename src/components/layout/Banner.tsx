import { Quote } from 'lucide-react'
import { motion } from 'framer-motion'

export function Banner() {
  return (
    <motion.div 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="relative border-b border-primary/30 shadow-md overflow-hidden"
      style={{
        background: 'linear-gradient(90deg, rgba(16, 31, 46, 1) 0%, rgba(16, 31, 46, 1) 50%, rgba(2, 14, 23, 1) 100%)'
      }}
    >
      {/* Subtle background pattern - same as header */}
      <div className="absolute inset-0 opacity-[0.02]">
        <div 
          className="absolute inset-0"
          style={{
            backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 20px, rgba(213, 177, 112, 0.05) 20px, rgba(213, 177, 112, 0.05) 40px)',
            backgroundSize: '40px 40px'
          }}
        />
      </div>

      {/* Shimmer Effect */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent"
        animate={{
          x: ['-100%', '200%'],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: 'linear',
        }}
      />

      <div className="relative max-w-7xl mx-auto px-6 lg:px-8 py-8 lg:py-10">
        <motion.div 
          className="flex items-center gap-5 lg:gap-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.6 }}
        >
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.4, type: 'spring', stiffness: 200, damping: 15 }}
          >
            <Quote className="h-10 w-10 lg:h-12 lg:w-12 text-sales/90 flex-shrink-0 drop-shadow-lg" />
          </motion.div>
          
          <motion.p 
            className="text-white text-lg lg:text-xl font-light leading-relaxed italic drop-shadow-md flex-1"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5, duration: 0.6 }}
          >
            <motion.span 
              className="font-semibold text-sales/95"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7, duration: 0.5 }}
            >
              Transformar desafios jurídicos em oportunidades
            </motion.span>
            , construindo relações duradouras e criando{' '}
            <motion.span 
              className="font-semibold text-sales/95"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9, duration: 0.5 }}
            >
              impactos reais
            </motion.span>
            {' '}para pessoas e negócios.
          </motion.p>
        </motion.div>
      </div>
    </motion.div>
  )
}

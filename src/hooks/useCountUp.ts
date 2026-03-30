import { useEffect, useState } from 'react'

/** Easing: easeOutExpo — rápido no início, suave no fim */
function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t)
}

type Options = {
  /** Duração da animação em ms */
  duration?: number
  /** Casas decimais (0 = inteiro). Para % use 0 ou 1 */
  decimals?: number
  /** Se false, não anima e retorna o valor direto */
  enabled?: boolean
}

/**
 * Retorna um número que anima de 0 até `value` ao montar ou quando `value` muda.
 * Útil para KPIs e totais que devem "subir" ao carregar a página.
 */
export function useCountUp(
  value: number,
  options: Options = {}
): number {
  const { duration = 1000, decimals = 0, enabled = true } = options
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    if (!enabled) {
      setDisplay(value)
      return
    }
    if (value === 0) {
      setDisplay(0)
      return
    }
    let startTime: number
    let rafId: number

    const animate = (now: number) => {
      if (startTime == null) startTime = now
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = easeOutExpo(progress)
      const current = eased * value
      setDisplay(current)
      if (progress < 1) rafId = requestAnimationFrame(animate)
    }

    setDisplay(0)
    rafId = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafId)
  }, [value, duration, enabled])

  if (!enabled) return value
  if (decimals === 0) return Math.round(display)
  const factor = Math.pow(10, decimals)
  return Math.round(display * factor) / factor
}

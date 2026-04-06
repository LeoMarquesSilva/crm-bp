export type OptionalNumericValue = {
  hasValue: boolean
  valid: boolean
  value: number
}

export type FinanceAreaAggregationInput = {
  areaLabel: string
  rateioValor: OptionalNumericValue
  rateioPercent: OptionalNumericValue
  valorContratoAnual: number
  valorPrimeiroFaturamento: number
}

export type FinanceAreaAggregationResult = {
  shouldAggregate: boolean
  valorAnualArea: number
  valorMensalArea: number
  percentValue: number
  consistencyMessage: string | null
}

/**
 * Regra única para participação financeira por área.
 * Mantém consistente o que entra na agregação e o que deve virar alerta.
 */
export function computeFinanceAreaAggregation(input: FinanceAreaAggregationInput): FinanceAreaAggregationResult {
  const pct = input.rateioPercent.valid ? input.rateioPercent.value / 100 : 0
  const valorAnualArea = input.rateioValor.valid ? input.rateioValor.value : input.valorContratoAnual * pct
  const valorMensalArea = input.valorPrimeiroFaturamento * pct
  const hasAreaData = input.rateioValor.hasValue || input.rateioPercent.hasValue
  const hasPositivePercent = input.rateioPercent.valid && input.rateioPercent.value > 0
  const hasPositiveExplicitValue = input.rateioValor.valid && input.rateioValor.value > 0

  if (!hasAreaData) {
    return { shouldAggregate: false, valorAnualArea, valorMensalArea, percentValue: 0, consistencyMessage: null }
  }

  // Só agrega quando há evidência positiva de participação da área:
  // - percentual > 0; ou
  // - valor explícito > 0.
  // Isso evita incluir áreas com "0" e percentual vazio/zero.
  if (!hasPositivePercent && !hasPositiveExplicitValue) {
    return {
      shouldAggregate: false,
      valorAnualArea,
      valorMensalArea,
      percentValue: input.rateioPercent.valid ? input.rateioPercent.value : 0,
      consistencyMessage: null,
    }
  }

  let consistencyMessage: string | null = null
  if (hasPositivePercent) {
    if (!input.rateioValor.hasValue) {
      consistencyMessage = `Rateio (${input.areaLabel}): percentual preenchido sem valor de rateio explícito`
    } else if (input.rateioValor.valid && input.rateioValor.value === 0) {
      consistencyMessage = `Rateio (${input.areaLabel}): percentual preenchido com valor de rateio zerado`
    }
  } else if (hasPositiveExplicitValue) {
    consistencyMessage = `Rateio (${input.areaLabel}): valor preenchido sem percentual de rateio (mensal pode ficar zerado)`
  }

  return {
    shouldAggregate: true,
    valorAnualArea,
    valorMensalArea,
    percentValue: input.rateioPercent.valid ? input.rateioPercent.value : 0,
    consistencyMessage,
  }
}

export type FinanceiroRegressionScenario = {
  name: string
  input: FinanceAreaAggregationInput
  expected: Pick<FinanceAreaAggregationResult, 'shouldAggregate' | 'consistencyMessage'>
}

/**
 * Cenários para validação de regressão das regras financeiras.
 * Pode ser usado em testes automatizados futuros.
 */
export const FINANCEIRO_REGRESSION_SCENARIOS: FinanceiroRegressionScenario[] = [
  {
    name: 'ignora area sem dados de rateio',
    input: {
      areaLabel: 'Cível',
      rateioValor: { hasValue: false, valid: false, value: 0 },
      rateioPercent: { hasValue: false, valid: false, value: 0 },
      valorContratoAnual: 1000,
      valorPrimeiroFaturamento: 100,
    },
    expected: { shouldAggregate: false, consistencyMessage: null },
  },
  {
    name: 'agrega area com valor de rateio zero e percentual maior que zero (com alerta)',
    input: {
      areaLabel: 'Tributário',
      rateioValor: { hasValue: true, valid: true, value: 0 },
      rateioPercent: { hasValue: true, valid: true, value: 50 },
      valorContratoAnual: 1000,
      valorPrimeiroFaturamento: 100,
    },
    expected: {
      shouldAggregate: true,
      consistencyMessage: 'Rateio (Tributário): percentual preenchido com valor de rateio zerado',
    },
  },
  {
    name: 'agrega area com percentual sem valor e gera alerta',
    input: {
      areaLabel: 'ADD',
      rateioValor: { hasValue: false, valid: false, value: 0 },
      rateioPercent: { hasValue: true, valid: true, value: 30 },
      valorContratoAnual: 1000,
      valorPrimeiroFaturamento: 100,
    },
    expected: {
      shouldAggregate: true,
      consistencyMessage: 'Rateio (ADD): percentual preenchido sem valor de rateio explícito',
    },
  },
  {
    name: 'agrega area com valor explicito positivo mesmo com percentual zero',
    input: {
      areaLabel: 'Insolvência',
      rateioValor: { hasValue: true, valid: true, value: 500 },
      rateioPercent: { hasValue: true, valid: true, value: 0 },
      valorContratoAnual: 1000,
      valorPrimeiroFaturamento: 100,
    },
    expected: {
      shouldAggregate: true,
      consistencyMessage: 'Rateio (Insolvência): valor preenchido sem percentual de rateio (mensal pode ficar zerado)',
    },
  },
]

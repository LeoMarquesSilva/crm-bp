# Auditoria Financeiro Dashboard

## Mapa dos KPIs (fonte, fórmula e filtro)

Fonte primária:
- `POST /api/validar-sheets` em `api/validar-sheets.js`
- Agregação financeira em `src/pages/AnalisePlanilha.tsx`
- Renderização em `src/pages/analise/FinanceiroSection.tsx`

KPIs:
- **Resumo financeiro**
  - `totalLeadsElegiveis`: linhas com `isFinanceFunil && isFinanceStage`
  - `totalValorContratoAnual`: soma de `valor_contrato_anual_financeiro` válido
  - `totalValorPrimeiroFaturamento`: soma de `valor_primeiro_faturamento_financeiro` válido
  - `ticketMedioAnual`: `totalValorContratoAnual / leadsComContratoAnual` (apenas valores numéricos válidos)
  - `mediaPrimeiroFaturamento`: média do primeiro faturamento em valores numéricos válidos
- **Evolução mensal**
  - Chave mensal: `primeiro_faturamento_financeiro` parseado para `YYYY-MM`
  - `leadsEntrada`: por `created_at_iso` (entrada CRM)
  - `leadsComFaturamento`: por mês de primeiro faturamento, ignorando linhas sem valores financeiros válidos
- **Financeiro por área**
  - Regra por área centralizada em `computeFinanceAreaAggregation` (`src/pages/analise/financeiroMetrics.ts`)
  - `participacoes`: número de participações de rateio por área
  - `leadsUnicas`: cardinalidade de lead por área (distinct)
  - `valorAnual`: valor explícito de rateio ou fallback `valorContratoAnual * percentual`
  - `valorMensal`: `valorPrimeiroFaturamento * percentual`
- **Validação**
  - Erros por `obrigatorio`, `formato`, `faixa`, `consistencia`
  - Consistência relevante: percentual > 0 sem valor explícito de rateio na área

## Amostra de reconciliação (regras críticas)

Principais divergências históricas corrigidas:
- **Rateio com valor explícito 0** entrava em agregação -> agora área é excluída da agregação.
- **Percentual 0 sem valor explícito positivo** gerava linha “lixo” com zero -> agora excluído.
- **Percentual > 0 sem valor explícito** ficava silencioso -> agora agrega e gera alerta de consistência.
- **Denominadores de médias** contavam campo não vazio mesmo inválido -> agora contam apenas valor numérico válido.
- **Parsing livre de data (`new Date(raw)`)** podia gerar mês incorreto -> removido do parse financeiro.

## Pacote rápido aplicado

- Distinção visual de área:
  - `participacoes` vs `leadsUnicas` no card e na tabela mensal por área.
- Semântica de período explicada em UI:
  - filtro global por `created_at` e mês da tabela por `primeiro_faturamento_financeiro`.
- Regras de agregação por área extraídas para módulo dedicado:
  - `src/pages/analise/financeiroMetrics.ts`

## Plano de evolução técnica

1. Expandir extração do motor financeiro para módulo dedicado (agregação mensal, validação e resumo).
2. Migrar o `useMemo` financeiro da página para funções puras testáveis.
3. Automatizar cenários de regressão definidos em `FINANCEIRO_REGRESSION_SCENARIOS`.

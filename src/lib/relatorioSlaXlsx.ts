import * as XLSX from 'xlsx'

export type SlaRelatorioLinha = {
  lead: string
  razao_social: string
  responsavel_nome: string
  responsavel_email: string
  area: string
  etapa: string
  funil: string
  dias_sem_movimentacao: number | null
  dias_sem_followup: number | null
  data_ultima_atualizacao: string
  data_criacao: string
  data_ultimo_followup: string
  anotacao_followup: string
  telefone: string
  deal_id: string
  link_crm: string
}

const COLUNAS: { key: keyof SlaRelatorioLinha; header: string }[] = [
  { key: 'lead', header: 'Lead' },
  { key: 'razao_social', header: 'Razão social' },
  { key: 'responsavel_nome', header: 'Responsável' },
  { key: 'responsavel_email', header: 'E-mail responsável' },
  { key: 'area', header: 'Área' },
  { key: 'funil', header: 'Funil' },
  { key: 'etapa', header: 'Etapa' },
  { key: 'dias_sem_movimentacao', header: 'Dias sem movimentação' },
  { key: 'dias_sem_followup', header: 'Dias sem follow-up' },
  { key: 'data_ultima_atualizacao', header: 'Última atualização' },
  { key: 'data_criacao', header: 'Criado em' },
  { key: 'data_ultimo_followup', header: 'Último follow-up' },
  { key: 'anotacao_followup', header: 'Anotação follow-up' },
  { key: 'telefone', header: 'Telefone' },
  { key: 'deal_id', header: 'ID negociação' },
  { key: 'link_crm', header: 'Link CRM' },
]

function linhaParaRegistro(r: SlaRelatorioLinha): Record<string, string | number> {
  const o: Record<string, string | number> = {}
  for (const { key, header } of COLUNAS) {
    const v = r[key]
    if (v == null || v === '') {
      o[header] = ''
    } else if (typeof v === 'number') {
      o[header] = v
    } else {
      o[header] = String(v)
    }
  }
  return o
}

export function downloadRelatorioSlaXlsx(options: {
  linhas: SlaRelatorioLinha[]
  gerado_em?: string
  nota?: string
}): void {
  const { linhas, gerado_em, nota } = options
  const rows = linhas.map(linhaParaRegistro)
  const ws =
    rows.length > 0
      ? XLSX.utils.json_to_sheet(rows)
      : XLSX.utils.aoa_to_sheet([COLUNAS.map((c) => c.header)])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Leads fora do SLA')

  const porResponsavel = new Map<string, number>()
  linhas.forEach((r) => {
    const key = r.responsavel_nome || r.responsavel_email || '(sem responsável)'
    porResponsavel.set(key, (porResponsavel.get(key) ?? 0) + 1)
  })
  const resumoRows = Array.from(porResponsavel.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([nome, count]) => ({ Responsável: nome, 'Leads atrasados': count }))
  const wsResumo =
    resumoRows.length > 0
      ? XLSX.utils.json_to_sheet(resumoRows)
      : XLSX.utils.aoa_to_sheet([['Responsável', 'Leads atrasados']])
  XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo por responsável')

  const obs: (string | number)[][] = [
    ['Gerado em (UTC)', gerado_em ?? ''],
    ['Total de leads atrasados', linhas.length],
    ['', ''],
    ['Observação', nota ?? ''],
  ]
  const wsObs = XLSX.utils.aoa_to_sheet(obs)
  XLSX.utils.book_append_sheet(wb, wsObs, 'Observações')

  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const fname = `relatorio-leads-fora-sla-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.xlsx`
  XLSX.writeFile(wb, fname)
}

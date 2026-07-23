import * as XLSX from 'xlsx'

export type ListaLeadsLinha = {
  nome_lead: string
  razao_social: string
  solicitante: string
  area: string
  email_solicitante: string
  funil: string
  etapa: string
  status: string
  data_criacao: string
  data_atualizacao: string
  motivo_perda: string
  tipo_lead: string
  indicacao: string
  nome_indicacao: string
  deal_id: string
  link_crm: string
}

const COLUNAS: { key: keyof ListaLeadsLinha; header: string }[] = [
  { key: 'nome_lead', header: 'Lead' },
  { key: 'razao_social', header: 'Razão social' },
  { key: 'solicitante', header: 'Solicitante' },
  { key: 'area', header: 'Área' },
  { key: 'email_solicitante', header: 'E-mail solicitante' },
  { key: 'funil', header: 'Funil' },
  { key: 'etapa', header: 'Etapa' },
  { key: 'status', header: 'Status' },
  { key: 'data_criacao', header: 'Criado em' },
  { key: 'data_atualizacao', header: 'Última atualização' },
  { key: 'motivo_perda', header: 'Motivo de perda' },
  { key: 'tipo_lead', header: 'Tipo de lead' },
  { key: 'indicacao', header: 'Indicação' },
  { key: 'nome_indicacao', header: 'Nome da indicação' },
  { key: 'deal_id', header: 'ID negociação' },
  { key: 'link_crm', header: 'Link CRM' },
]

function linhaParaRegistro(r: ListaLeadsLinha): Record<string, string> {
  const o: Record<string, string> = {}
  for (const { key, header } of COLUNAS) {
    o[header] = r[key] ?? ''
  }
  return o
}

export function downloadListaLeadsXlsx(options: {
  linhas: ListaLeadsLinha[]
  filtrosLabel?: string
  nomeArquivoBase?: string
}): void {
  const { linhas, filtrosLabel, nomeArquivoBase } = options
  const rows = linhas.map(linhaParaRegistro)
  const ws =
    rows.length > 0
      ? XLSX.utils.json_to_sheet(rows)
      : XLSX.utils.aoa_to_sheet([COLUNAS.map((c) => c.header)])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Leads (filtro atual)')

  const porEtapa = new Map<string, number>()
  const porArea = new Map<string, number>()
  linhas.forEach((r) => {
    const etapaKey = r.etapa || '(sem etapa)'
    porEtapa.set(etapaKey, (porEtapa.get(etapaKey) ?? 0) + 1)
    const areaKey = r.area || '(sem área)'
    porArea.set(areaKey, (porArea.get(areaKey) ?? 0) + 1)
  })
  const resumoEtapaRows = Array.from(porEtapa.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([etapa, total]) => ({ Etapa: etapa, Total: total }))
  const wsResumoEtapa =
    resumoEtapaRows.length > 0
      ? XLSX.utils.json_to_sheet(resumoEtapaRows)
      : XLSX.utils.aoa_to_sheet([['Etapa', 'Total']])
  XLSX.utils.book_append_sheet(wb, wsResumoEtapa, 'Resumo por etapa')

  const resumoAreaRows = Array.from(porArea.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([area, total]) => ({ Área: area, Total: total }))
  const wsResumoArea =
    resumoAreaRows.length > 0
      ? XLSX.utils.json_to_sheet(resumoAreaRows)
      : XLSX.utils.aoa_to_sheet([['Área', 'Total']])
  XLSX.utils.book_append_sheet(wb, wsResumoArea, 'Resumo por área')

  const obs: (string | number)[][] = [
    ['Gerado em', new Date().toLocaleString('pt-BR')],
    ['Filtros aplicados', filtrosLabel ?? '—'],
    ['Total de leads', linhas.length],
  ]
  const wsObs = XLSX.utils.aoa_to_sheet(obs)
  XLSX.utils.book_append_sheet(wb, wsObs, 'Observações')

  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const base = nomeArquivoBase || 'leads-filtro-dashboard'
  const fname = `${base}-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.xlsx`
  XLSX.writeFile(wb, fname)
}

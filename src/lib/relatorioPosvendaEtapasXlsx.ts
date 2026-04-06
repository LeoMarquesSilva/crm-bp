import * as XLSX from 'xlsx'

export type PosvendaRelatorioLinha = {
  deal_id: string
  nome_negociacao: string
  nome_empresa: string
  etapa_rd: string
  etapa_grupo: string
  dias_desde_ultima_atualizacao_rd: number | null
  data_ultima_atualizacao_rd: string
  data_ultima_atualizacao_br: string
  criado_em_rd: string
  criado_em_br: string
  responsavel_nome: string
  responsavel_email: string
  solicitante: string
  contato_email: string
  pausada: boolean
  link_crm: string
}

const COLUNAS: { key: keyof PosvendaRelatorioLinha; header: string }[] = [
  { key: 'deal_id', header: 'ID negociação' },
  { key: 'etapa_grupo', header: 'Grupo da etapa' },
  { key: 'etapa_rd', header: 'Etapa no RD' },
  { key: 'dias_desde_ultima_atualizacao_rd', header: 'Dias (ref. últ. atualiz. no RD)' },
  { key: 'data_ultima_atualizacao_br', header: 'Data últ. atualização' },
  { key: 'nome_negociacao', header: 'Nome da negociação' },
  { key: 'nome_empresa', header: 'Empresa' },
  { key: 'responsavel_nome', header: 'Responsável' },
  { key: 'responsavel_email', header: 'E-mail responsável' },
  { key: 'solicitante', header: 'Solicitante' },
  { key: 'contato_email', header: 'E-mail contato' },
  { key: 'pausada', header: 'Pausada' },
  { key: 'link_crm', header: 'Link CRM' },
]

function linhaParaRegistro(r: PosvendaRelatorioLinha): Record<string, string | number> {
  const o: Record<string, string | number> = {}
  for (const { key, header } of COLUNAS) {
    if (key === 'pausada') {
      o[header] = r.pausada ? 'Sim' : 'Não'
      continue
    }
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

export function downloadRelatorioPosvendaEtapasXlsx(options: {
  linhas: PosvendaRelatorioLinha[]
  gerado_em?: string
  nota_dias?: string
}): void {
  const { linhas, gerado_em, nota_dias } = options
  const rows = linhas.map(linhaParaRegistro)
  const ws =
    rows.length > 0
      ? XLSX.utils.json_to_sheet(rows)
      : XLSX.utils.aoa_to_sheet([COLUNAS.map((c) => c.header)])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Pós-venda')

  const obs: (string | number)[][] = [
    ['Gerado em (UTC)', gerado_em ?? ''],
    ['', ''],
    ['Observação', nota_dias ?? ''],
  ]
  const wsObs = XLSX.utils.aoa_to_sheet(obs)
  XLSX.utils.book_append_sheet(wb, wsObs, 'Observações')

  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const fname = `relatorio-posvenda-etapas-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.xlsx`
  XLSX.writeFile(wb, fname)
}

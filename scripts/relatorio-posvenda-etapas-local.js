/* eslint-disable no-console */
/**
 * Gera relatório CSV/JSON das negociações abertas nas etapas:
 * - Inclusão no fluxo de faturamento
 * - Boas-vindas ao cliente (e equivalentes no RD, ex.: Boas-vindas RECEP.)
 *
 * Uso:
 *   node scripts/relatorio-posvenda-etapas-local.js
 *   node scripts/relatorio-posvenda-etapas-local.js --json
 *   node scripts/relatorio-posvenda-etapas-local.js --out=relatorio-posvenda.csv
 */
import fs from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { fetchRelatorioPosvendaEtapas } from '../api/relatorio-posvenda-etapas.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

function loadEnvFromRoot() {
  for (const f of ['.env', '.env.local']) {
    const p = join(root, f)
    if (!fs.existsSync(p)) continue
    try {
      for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const eq = trimmed.indexOf('=')
        if (eq === -1) continue
        const key = trimmed.slice(0, eq).trim()
        let val = trimmed.slice(eq + 1).trim()
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1)
        }
        if (key) process.env[key] = val
      }
    } catch (_) {}
  }
}

function escapeCsvCell(v) {
  const s = v == null ? '' : String(v)
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function toCsv(rows) {
  const headers = [
    'deal_id',
    'etapa_grupo',
    'etapa_rd',
    'dias_desde_ultima_atualizacao_rd',
    'data_ultima_atualizacao_br',
    'nome_negociacao',
    'nome_empresa',
    'responsavel_nome',
    'responsavel_email',
    'solicitante',
    'contato_email',
    'pausada',
    'link_crm',
  ]
  const lines = [headers.join(',')]
  for (const r of rows) {
    lines.push(headers.map((h) => escapeCsvCell(r[h])).join(','))
  }
  return lines.join('\r\n')
}

function parseArgs(argv) {
  let json = false
  let out = ''
  for (const a of argv) {
    if (a === '--json') json = true
    if (a.startsWith('--out=')) out = a.slice(6).trim()
  }
  return { json, out }
}

async function main() {
  loadEnvFromRoot()
  const token = process.env.RD_CRM_TOKEN
  if (!token) {
    console.error('RD_CRM_TOKEN não encontrado em .env/.env.local')
    process.exit(1)
  }

  const { json, out } = parseArgs(process.argv.slice(2))
  const data = await fetchRelatorioPosvendaEtapas(token)

  if (json) {
    const payload = JSON.stringify(data, null, 2)
    if (out) {
      fs.writeFileSync(out, payload, 'utf8')
      console.error(`Escrito: ${out}`)
    } else {
      console.log(payload)
    }
    return
  }

  const csv = toCsv(data.linhas)
  if (out) {
    fs.writeFileSync(out, '\uFEFF' + csv, 'utf8')
    console.error(`CSV (UTF-8 BOM): ${out}`)
    console.error(data.meta.nota_dias)
    return
  }

  console.error(data.meta.nota_dias)
  console.error(`Total: ${data.linhas.length} negociação(ões)\n`)
  console.log(csv)
}

main().catch((e) => {
  console.error(e?.message || e)
  process.exit(1)
})

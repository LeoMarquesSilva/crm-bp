/* eslint-disable no-console */
/**
 * Sincroniza status/etapa/updated_at da planilha com o RD CRM.
 *
 * Uso:
 *   node scripts/sync-status-rd-sheets-local.js           # dry-run (padrão)
 *   node scripts/sync-status-rd-sheets-local.js --apply   # grava na planilha
 */
import { loadEnvFromRoot } from './dev-api-app.js'
import { runStatusSync } from '../api/sync-status-rd-sheets.js'

loadEnvFromRoot()

const apply = process.argv.includes('--apply')
const spreadsheetId = (process.env.VITE_PLANILHA_ID || '').trim()
const sheetName = (process.env.VITE_PLANILHA_ABA || '').trim() || undefined

async function main() {
  if (!spreadsheetId) {
    throw new Error('VITE_PLANILHA_ID não configurado em .env/.env.local')
  }

  console.log(apply ? 'Aplicando correções na planilha...' : 'Dry-run (use --apply para gravar)...')

  const report = await runStatusSync({
    spreadsheetId,
    sheetName,
    dryRun: !apply,
    maxSample: 100,
  })

  console.log(JSON.stringify(report, null, 2))
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})

/**
 * Servidor local para desenvolvimento: expõe POST /api/validar-sheets e POST /api/enviar-whatsapp
 * para que "npm run dev" (só Vite) consiga validar planilha e enviar WhatsApp sem "vercel dev".
 * O Vite faz proxy de /api para http://localhost:3001.
 * Carrega .env e .env.local para EVOLUTION_*, N8N_WEBHOOK_*, etc.
 */
import { readFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import express from 'express'
import handlerValidar from '../api/validar-sheets.js'
import handlerWhatsapp from '../api/enviar-whatsapp.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
for (const f of ['.env', '.env.local']) {
  const p = join(root, f)
  if (existsSync(p)) {
    try {
      for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
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

const app = express()
const PORT = 3001

app.use(express.json())

app.all('/api/validar-sheets', (req, res) => handlerValidar(req, res))
app.all('/api/enviar-whatsapp', (req, res) => handlerWhatsapp(req, res))

app.listen(PORT, () => {
  console.log(`[dev-api] API local em http://localhost:${PORT} (proxy do Vite em /api)`)
})

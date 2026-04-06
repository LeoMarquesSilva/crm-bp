/**
 * App Express com as rotas /api/* usadas em desenvolvimento.
 * Carregado pelo Vite (middleware) e opcionalmente por dev-api-server.js na porta 3001.
 */
import { readFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import express from 'express'
import handlerValidar from '../api/validar-sheets.js'
import handlerWhatsapp from '../api/enviar-whatsapp.js'
import handlerSyncAnotacoes from '../api/sync-anotacoes.js'
import handlerSyncFinanceiroRd from '../api/sync-financeiro-rd.js'
import handlerAuditarEtapa1RdSheets from '../api/auditar-etapa1-rd-sheets.js'
import handlerRelatorioPosvendaEtapas from '../api/relatorio-posvenda-etapas.js'
import handlerGoogleOAuth from '../api/google-oauth.js'
import handlerGoogleOAuthRefresh from '../api/google-oauth-refresh.js'
import handlerUploadGoogleDrive from '../api/upload-google-drive.js'
import handlerEvolutionInfo from '../api/evolution-info.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

export function loadEnvFromRoot() {
  for (const f of ['.env', '.env.local']) {
    const p = join(root, f)
    if (!existsSync(p)) continue
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

export function createDevApiApp() {
  loadEnvFromRoot()

  const app = express()

  app.use((req, res, next) => {
    const origin = req.headers.origin
    const allowOrigins = [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:5174',
    ]
    if (origin && (allowOrigins.includes(origin) || origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:'))) {
      res.setHeader('Access-Control-Allow-Origin', origin)
    } else {
      res.setHeader('Access-Control-Allow-Origin', '*')
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    if (req.method === 'OPTIONS') return res.sendStatus(204)
    next()
  })

  app.use(express.json({ limit: '20mb' }))

  app.all('/api/validar-sheets', (req, res) => handlerValidar(req, res))
  app.all('/api/enviar-whatsapp', (req, res) => handlerWhatsapp(req, res))
  app.all('/api/sync-anotacoes', (req, res) => handlerSyncAnotacoes(req, res))
  app.all('/api/sync-financeiro-rd', (req, res) => handlerSyncFinanceiroRd(req, res))
  app.all('/api/auditar-etapa1-rd-sheets', (req, res) => handlerAuditarEtapa1RdSheets(req, res))
  app.all('/api/relatorio-posvenda-etapas', (req, res) => handlerRelatorioPosvendaEtapas(req, res))
  app.all('/api/google-oauth', (req, res) => handlerGoogleOAuth(req, res))
  app.all('/api/google-oauth-refresh', (req, res) => handlerGoogleOAuthRefresh(req, res))
  app.all('/api/upload-google-drive', (req, res) => handlerUploadGoogleDrive(req, res))
  app.all('/api/evolution-info', (req, res) => handlerEvolutionInfo(req, res))
  app.all('/api/evolution', (req, res) => handlerEvolutionInfo(req, res))

  return app
}

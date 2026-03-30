/**
 * Servidor local opcional na porta 3001 (npm run dev:api).
 * Em desenvolvimento normal, a API já roda dentro do Vite (middleware) — não é obrigatório.
 */
import { createDevApiApp } from './dev-api-app.js'

const PORT = 3001
const app = createDevApiApp()

app.listen(PORT, () => {
  console.log(`[dev-api] API local em http://localhost:${PORT} (opcional; use npm run dev — API integrada ao Vite)`)
})

/**
 * Assistente de IA para análise dos resultados do dashboard.
 * Usa OpenAI API (VITE_OPENAI_API_KEY) para responder dúvidas e dar sugestões com base no contexto dos dados.
 */
import { useState, useRef, useEffect } from 'react'
import { MessageCircle, X, Send, Loader2, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions'
const MODEL = 'gpt-4o-mini'

export type AiMessage = { role: 'user' | 'assistant'; content: string }

type AiAssistantProps = {
  /** Resumo em texto dos dados atuais do dashboard (período, totais, por área, motivos, etc.) */
  contextSummary: string
  /** Período/filtro atual em uma linha (ex: "Jan/2025 · Funil Vendas") */
  periodLabel?: string
  className?: string
}

const SYSTEM_PROMPT = `Você é um assistente de análise de CRM/pipeline de vendas. O usuário está vendo um dashboard com dados de leads (negociações).
Responda em português, de forma objetiva e útil. Use APENAS os dados do contexto abaixo — NUNCA invente datas, valores ou filtros.

REGRAS OBRIGATÓRIAS PARA DATAS E PERÍODOS:
1. Date_Create (ou created_at_iso) = quando a lead foi CRIADA.
2. Date_Update (ou updated_at_iso) = quando a lead foi ATUALIZADA/FINALIZADA (ex.: marcada como ganha).
3. data_assinatura_contrato = data em que o contrato foi assinado (quando existir).
4. Para perguntas como "contratos assinados em dezembro" ou "negociações fechadas em dezembro": SEMPRE filtre usando as colunas de data do contexto. Use data_assinatura_contrato para "contrato assinado em [mês]" ou Date_Update para "finalizadas em [mês]". Extraia o mês/ano da data (formato ISO ou DD/MM/AAAA) e inclua na resposta APENAS os registros cuja data está no período pedido.
5. Para valores totais por período: some apenas os registros que atendem ao filtro de data; liste cada negociação com sua data e valor antes de dar o total.

Use os dados do contexto para:
- Analisar resultados (ganhas, perdidas, em andamento)
- Dar sugestões baseadas nos números (ex.: motivos de perda recorrentes, áreas com melhor desempenho)
- Analisar as ANOTAÇÕES DE MOTIVO DE PERDA (motivo_perda_anotacao) no bloco correspondente.
- Analisar VALORES das negociações GANHAS no bloco "NEGOCIAÇÕES GANHAS (valores e datas)": cada linha tem Date_Create, Date_Update, data_assinatura_contrato, estado e valores. Use essas datas para qualquer filtro por mês/ano antes de listar valores ou totais.

Se não houver informação suficiente no contexto para responder, diga isso e sugira olhar o filtro ou os dados na tela.`

/** Perguntas pré-prontas: ao clicar, a pergunta é enviada diretamente */
const SUGGESTED_QUESTIONS = [
  'Dê um resumo do desempenho do período.',
  'Quais os valores das negociações marcadas como ganhas?',
  'Qual o total em valores nas negociações ganhas?',
  'Quais anotações de motivos de perda mais constantes?',
  'Quais motivos de perda mais aparecem?',
  'Qual área tem melhor desempenho?',
  'Quem são os top indicadores (nome indicação)?',
  'Quais sugestões você daria para melhorar os resultados?',
]

export function AiAssistant({ contextSummary, periodLabel, className }: AiAssistantProps) {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY as string | undefined
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<AiMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [open, messages])

  const hasKey = Boolean(apiKey?.trim())

  const sendMessageWithText = async (textToSend: string) => {
    const text = textToSend.trim()
    if (!text || loading || !hasKey) return

    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content: text }])
    setLoading(true)
    setError(null)

    const contextBlock = contextSummary
      ? `\n\n--- DADOS ATUAIS DO DASHBOARD ---\n${contextSummary}\n--- FIM DOS DADOS ---`
      : '\n\n(Nenhum dado carregado no dashboard no momento.)'

    try {
      const res = await fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT + contextBlock },
            ...messages.map((m) => ({ role: m.role, content: m.content })),
            { role: 'user', content: text },
          ],
          max_tokens: 1024,
          temperature: 0.5,
        }),
      })

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        const msg = (errBody as { error?: { message?: string } })?.error?.message || res.statusText
        throw new Error(msg || `Erro ${res.status}`)
      }

      const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
      const reply = data.choices?.[0]?.message?.content?.trim() ?? 'Não foi possível obter resposta.'
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }])
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Erro ao chamar a API.'
      setError(message)
      setMessages((prev) => [...prev, { role: 'assistant', content: `_Erro: ${message}_` }])
    } finally {
      setLoading(false)
    }
  }

  const sendMessage = () => sendMessageWithText(input)

  if (!hasKey) {
    return (
      <div
        className={cn('fixed bottom-6 right-6 z-40', className)}
        title="Configure VITE_OPENAI_API_KEY no .env para usar o assistente"
      >
        <button
          type="button"
          disabled
          className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-200 text-gray-500 shadow-lg cursor-not-allowed"
          aria-label="Assistente de IA (chave não configurada)"
        >
          <Sparkles className="h-6 w-6" />
        </button>
      </div>
    )
  }

  return (
    <>
      {/* Botão flutuante */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg hover:bg-primary/90 transition-colors',
          open && 'bg-primary/90',
          className
        )}
        aria-label={open ? 'Fechar assistente' : 'Abrir assistente de IA'}
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-7 w-7" />}
      </button>

      {/* Painel */}
      {open && (
        <div
          className="fixed bottom-24 right-6 z-40 flex w-[min(420px,calc(100vw-3rem))] flex-col rounded-2xl border border-gray-200 bg-white shadow-xl overflow-hidden"
          role="dialog"
          aria-label="Assistente de análise"
        >
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-primary/5">
            <Sparkles className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-gray-900">Assistente de análise</h3>
          </div>
          {periodLabel && (
            <p className="px-4 py-1.5 text-xs text-gray-500 bg-gray-50 border-b border-gray-100 truncate" title={periodLabel}>
              {periodLabel}
            </p>
          )}

          <div ref={listRef} className="flex-1 min-h-[240px] max-h-[320px] overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <div className="space-y-3">
                <p className="text-sm text-gray-600 font-medium">Perguntas prontas (clique para enviar):</p>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTED_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => sendMessageWithText(q)}
                      disabled={loading}
                      className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-left text-xs font-medium text-primary hover:bg-primary/10 hover:border-primary/50 disabled:opacity-50 transition-colors max-w-full"
                    >
                      {q}
                    </button>
                  ))}
                </div>
                <p className="text-sm text-gray-500 pt-2">Ou digite sua pergunta abaixo.</p>
              </div>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  'rounded-xl px-3 py-2 text-sm max-w-[95%]',
                  msg.role === 'user'
                    ? 'ml-auto bg-primary text-white'
                    : 'mr-auto bg-gray-100 text-gray-900 whitespace-pre-wrap'
                )}
              >
                {msg.content}
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-2 text-gray-500 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Analisando...</span>
              </div>
            )}
          </div>

          {error && (
            <div className="px-4 py-2 bg-red-50 border-t border-red-100 text-xs text-red-700">
              {error}
            </div>
          )}

          <div className="flex gap-2 p-3 border-t border-gray-100">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              placeholder="Pergunte sobre os resultados..."
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
              disabled={loading}
            />
            <button
              type="button"
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              className="rounded-lg bg-primary px-3 py-2 text-white hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Enviar"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </>
  )
}

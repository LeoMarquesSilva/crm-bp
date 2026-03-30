import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Trash2, Users, User, Star, RefreshCw, Loader2, Cloud } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  type WppDestination,
  type WppDestinationKind,
  loadWppDestinations,
  saveWppDestinations,
  getDefaultWppDestinationId,
  setDefaultWppDestinationId,
  WPP_DESTINATIONS_EVENT,
} from '@/lib/wppDestinations'

/** Base da API (vazio = mesmo host; sem barra final). */
function apiOrigin(): string {
  return (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
}

type EvolutionGroupRow = {
  id: string
  subject: string
  size: number | null
  pictureUrl: string | null
}

type EvolutionContactRow = {
  remoteJid: string
  name: string
  profilePicUrl: string | null
}

type EvolutionInstanceMeta = {
  instanceName: string | null
  instanceId: string | null
  owner: string | null
  profileName: string | null
  profilePictureUrl: string | null
  profileStatus: string | null
  status: string | null
  serverUrl: string | null
}

type EvolutionSnapshot = {
  ok?: boolean
  message?: string
  instance: string
  instanceValid?: boolean
  instanceFromApi?: EvolutionInstanceMeta | null
  availableInstances?: string[]
  connection: unknown
  groups: EvolutionGroupRow[]
  contacts: EvolutionContactRow[]
  partialErrors?: Record<string, string>
  fetchedAt: string
}

function connectionLabel(connection: unknown): string {
  if (connection == null) return '—'
  if (typeof connection === 'object' && connection !== null) {
    const o = connection as Record<string, unknown>
    if (typeof o.state === 'string') return o.state
    const inst = o.instance
    if (inst && typeof inst === 'object') {
      const st = (inst as Record<string, unknown>).state
      if (typeof st === 'string') return st
    }
  }
  return '—'
}

function newId(): string {
  return crypto.randomUUID?.() ?? `wpp-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function ConfigNotificacoesWpp() {
  const [items, setItems] = useState<WppDestination[]>([])
  const [defaultId, setDefaultId] = useState<string | null>(null)
  const [label, setLabel] = useState('')
  const [kind, setKind] = useState<WppDestinationKind>('pessoa')
  const [value, setValue] = useState('')
  const [savedFlash, setSavedFlash] = useState(false)
  const [evoLoading, setEvoLoading] = useState(false)
  const [evoError, setEvoError] = useState<string | null>(null)
  const [evoSnapshot, setEvoSnapshot] = useState<EvolutionSnapshot | null>(null)
  const [evoWarning, setEvoWarning] = useState<string | null>(null)

  const reload = useCallback(() => {
    setItems(loadWppDestinations())
    setDefaultId(getDefaultWppDestinationId())
  }, [])

  useEffect(() => {
    reload()
    const onStorage = () => reload()
    window.addEventListener('storage', onStorage)
    window.addEventListener(WPP_DESTINATIONS_EVENT, onStorage)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener(WPP_DESTINATIONS_EVENT, onStorage)
    }
  }, [reload])

  const persist = useCallback(
    (next: WppDestination[], nextDefault: string | null) => {
      saveWppDestinations(next)
      setDefaultWppDestinationId(nextDefault)
      setItems(next)
      setDefaultId(nextDefault)
      setSavedFlash(true)
      window.setTimeout(() => setSavedFlash(false), 2000)
    },
    []
  )

  const handleAdd = () => {
    const l = label.trim()
    const v = value.trim()
    if (!l || !v) return
    const row: WppDestination = { id: newId(), label: l, kind, value: v }
    const next = [...items, row]
    const def = defaultId ?? row.id
    persist(next, def)
    setLabel('')
    setValue('')
    setKind('pessoa')
  }

  const handleRemove = (id: string) => {
    const next = items.filter((x) => x.id !== id)
    let def = defaultId === id ? null : defaultId
    if (def && !next.some((x) => x.id === def)) def = next[0]?.id ?? null
    persist(next, def)
  }

  const handleSetDefault = (id: string) => {
    persist(items, id)
  }

  const fetchEvolutionInfo = useCallback(async () => {
    setEvoLoading(true)
    setEvoError(null)
    setEvoWarning(null)
    const base = apiOrigin()
    const urls = [`${base}/api/evolution-info`, `${base}/api/evolution`]
    try {
      let res = await fetch(urls[0])
      if (res.status === 404) {
        res = await fetch(urls[1])
      }
      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
      if (!res.ok) {
        if (res.status === 404) {
          setEvoError(
            'Endpoint da API não encontrado (404). ' +
              'Em desenvolvimento: rode npm run dev (a API /api está integrada ao Vite). ' +
              'Na Vercel: faça deploy com a pasta api/ e as variáveis EVOLUTION_API_URL, EVOLUTION_API_KEY e EVOLUTION_INSTANCE.'
          )
        } else {
          setEvoError(
            typeof json.message === 'string'
              ? json.message
              : typeof json.error === 'string'
                ? json.error
                : 'Não foi possível obter os dados da Evolution.'
          )
        }
        setEvoSnapshot(null)
        return
      }

      const partial = json.partialErrors as Record<string, string> | undefined
      const partialText =
        partial && Object.keys(partial).length > 0
          ? Object.entries(partial)
              .map(([k, v]) => `${k}: ${v}`)
              .join(' · ')
          : null

      if (json.ok === false && typeof json.message === 'string') {
        setEvoWarning(json.message + (partialText ? ` (${partialText})` : ''))
      } else if (partialText) {
        setEvoWarning(`Algumas consultas falharam: ${partialText}`)
      }

      setEvoSnapshot({
        ok: json.ok !== false,
        message: typeof json.message === 'string' ? json.message : undefined,
        instance: String(json.instance ?? ''),
        instanceValid: json.instanceValid !== false,
        instanceFromApi: (json.instanceFromApi as EvolutionInstanceMeta | null | undefined) ?? null,
        availableInstances: Array.isArray(json.availableInstances)
          ? (json.availableInstances as string[])
          : undefined,
        connection: json.connection ?? null,
        groups: Array.isArray(json.groups) ? (json.groups as EvolutionGroupRow[]) : [],
        contacts: Array.isArray(json.contacts) ? (json.contacts as EvolutionContactRow[]) : [],
        partialErrors: partial,
        fetchedAt: String(json.fetchedAt ?? new Date().toISOString()),
      })
    } catch {
      setEvoError(
        'Erro de rede. Em desenvolvimento, use npm run dev. Em produção, confira o deploy e VITE_API_URL se estiver definido.'
      )
      setEvoSnapshot(null)
    } finally {
      setEvoLoading(false)
    }
  }, [])

  const applyEvolutionGroup = (g: EvolutionGroupRow) => {
    setKind('grupo')
    setValue(g.id)
    setLabel((g.subject || 'Grupo').trim() || 'Grupo')
  }

  const applyEvolutionContact = (c: EvolutionContactRow) => {
    setKind('pessoa')
    setValue(c.remoteJid)
    setLabel(c.name || c.remoteJid.split('@')[0] || 'Contato')
  }

  return (
    <div className="max-w-5xl mx-auto">
      <p className="text-sm text-gray-600 mb-4">
        Cadastre grupos ou pessoas para enviar relatórios do dashboard. No envio, escolha o destino na aba Relatórios.{' '}
        <Link to="/analise-planilha" className="font-medium text-primary hover:underline">
          Ir ao Dashboard
        </Link>
      </p>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-6">
        <div className="rounded-lg border border-sky-100 bg-sky-50/50 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-600/15 text-sky-800">
                <Cloud className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Evolution API</h2>
                <p className="text-xs text-gray-600 mt-0.5">
                  Busca instância (fetchInstances), conexão, grupos e contatos via variáveis do servidor:{' '}
                  <code className="text-[11px] bg-white/80 px-1 rounded">EVOLUTION_API_URL</code>,{' '}
                  <code className="text-[11px] bg-white/80 px-1 rounded">EVOLUTION_API_KEY</code>,{' '}
                  <code className="text-[11px] bg-white/80 px-1 rounded">EVOLUTION_INSTANCE</code>.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void fetchEvolutionInfo()}
              disabled={evoLoading}
              className="inline-flex items-center gap-2 rounded-lg bg-sky-700 px-3 py-2 text-sm font-medium text-white hover:bg-sky-800 disabled:opacity-60"
            >
              {evoLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Buscar dados na Evolution
            </button>
          </div>
          {evoError && (
            <p className="mt-3 text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{evoError}</p>
          )}
          {evoWarning && (
            <p className="mt-3 text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              {evoWarning}
            </p>
          )}
          {evoSnapshot && (
            <div className="mt-3 space-y-4 text-sm">
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-gray-700">
                <span>
                  <span className="text-gray-500">Instância (.env):</span>{' '}
                  <strong className="font-mono">{evoSnapshot.instance}</strong>
                  {evoSnapshot.instanceValid === false && (
                    <span className="ml-2 text-xs font-semibold text-red-700">(não encontrada na API)</span>
                  )}
                </span>
                {evoSnapshot.instanceFromApi?.profileName && (
                  <span>
                    <span className="text-gray-500">Perfil:</span>{' '}
                    <strong>{evoSnapshot.instanceFromApi.profileName}</strong>
                  </span>
                )}
                <span>
                  <span className="text-gray-500">Conexão:</span>{' '}
                  <strong className="text-emerald-800">{connectionLabel(evoSnapshot.connection)}</strong>
                </span>
                <span className="text-xs text-gray-500">
                  Atualizado: {new Date(evoSnapshot.fetchedAt).toLocaleString('pt-BR')}
                </span>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Grupos</h3>
                {evoSnapshot.groups.length === 0 ? (
                  <p className="text-gray-600 text-sm">Nenhum grupo retornado.</p>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold text-gray-600">
                          <th className="px-3 py-2">Grupo</th>
                          <th className="px-3 py-2 w-24">Membros</th>
                          <th className="px-3 py-2 font-mono text-xs">JID</th>
                          <th className="px-3 py-2 w-36" />
                        </tr>
                      </thead>
                      <tbody>
                        {evoSnapshot.groups.map((g) => (
                          <tr key={g.id} className="border-b border-gray-100 last:border-0">
                            <td className="px-3 py-2 font-medium text-gray-900">{g.subject || '(sem nome)'}</td>
                            <td className="px-3 py-2 text-gray-600">{g.size ?? '—'}</td>
                            <td className="px-3 py-2 font-mono text-[11px] text-gray-700 break-all max-w-[200px]">
                              {g.id}
                            </td>
                            <td className="px-3 py-2">
                              <button
                                type="button"
                                onClick={() => applyEvolutionGroup(g)}
                                className="text-primary font-medium hover:underline text-xs"
                              >
                                Usar no formulário
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Contatos</h3>
                {evoSnapshot.contacts.length === 0 ? (
                  <p className="text-gray-600 text-sm">
                    Nenhum contato retornado (ou falha em findContacts — veja o aviso acima).
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white max-h-80 overflow-y-auto">
                    <table className="min-w-full text-sm">
                      <thead className="sticky top-0 bg-gray-50">
                        <tr className="border-b border-gray-200 text-left text-xs font-semibold text-gray-600">
                          <th className="px-3 py-2">Nome</th>
                          <th className="px-3 py-2 font-mono text-xs">JID</th>
                          <th className="px-3 py-2 w-36" />
                        </tr>
                      </thead>
                      <tbody>
                        {evoSnapshot.contacts.map((c) => (
                          <tr key={c.remoteJid} className="border-b border-gray-100 last:border-0">
                            <td className="px-3 py-2 font-medium text-gray-900">{c.name || '—'}</td>
                            <td className="px-3 py-2 font-mono text-[11px] text-gray-700 break-all max-w-[220px]">
                              {c.remoteJid}
                            </td>
                            <td className="px-3 py-2">
                              <button
                                type="button"
                                onClick={() => applyEvolutionContact(c)}
                                className="text-primary font-medium hover:underline text-xs"
                              >
                                Usar no formulário
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div>
          <h2 className="text-sm font-semibold text-gray-800 mb-3">Adicionar destino</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Nome (como aparece na lista)</label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Ex.: Grupo Comercial, Maria Silva"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setKind('pessoa')}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                    kind === 'pessoa'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100'
                  )}
                >
                  <User className="h-4 w-4" />
                  Pessoa
                </button>
                <button
                  type="button"
                  onClick={() => setKind('grupo')}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                    kind === 'grupo'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100'
                  )}
                >
                  <Users className="h-4 w-4" />
                  Grupo
                </button>
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                {kind === 'grupo' ? 'ID do grupo (JID)' : 'WhatsApp (DDD + número)'}
              </label>
              <input
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={
                  kind === 'grupo'
                    ? 'Ex.: 120363...@g.us (conforme Evolution / WhatsApp)'
                    : 'Ex.: 11999999999 ou 5511999999999'
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-primary"
              />
              <p className="text-xs text-gray-500 mt-1">
                {kind === 'grupo'
                  ? 'Grupos usam o identificador com @g.us. Copie no painel da Evolution ou no WhatsApp Business.'
                  : 'Número com DDD ou JID completo (ex.: 5511...@s.whatsapp.net) vindo da Evolution.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleAdd}
            disabled={!label.trim() || !value.trim()}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Salvar destino
          </button>
        </div>

        {savedFlash && (
          <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
            Alterações salvas neste navegador.
          </p>
        )}

        <div>
          <h2 className="text-sm font-semibold text-gray-800 mb-3">Destinos cadastrados</h2>
          {items.length === 0 ? (
            <p className="text-sm text-gray-500 py-6 text-center rounded-lg border border-dashed border-gray-200">
              Nenhum destino ainda. Adicione acima.
            </p>
          ) : (
            <ul className="space-y-2">
              {items.map((d) => (
                <li
                  key={d.id}
                  className="flex flex-wrap items-center gap-2 justify-between rounded-lg border border-gray-100 bg-gray-50/80 px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900 truncate">{d.label}</span>
                      <span
                        className={cn(
                          'text-[10px] uppercase font-semibold px-2 py-0.5 rounded',
                          d.kind === 'grupo' ? 'bg-violet-100 text-violet-800' : 'bg-sky-100 text-sky-800'
                        )}
                      >
                        {d.kind === 'grupo' ? 'Grupo' : 'Pessoa'}
                      </span>
                      {defaultId === d.id && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                          <Star className="h-3 w-3" />
                          Padrão
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-mono text-gray-600 truncate mt-0.5" title={d.value}>
                      {d.value}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {defaultId !== d.id && (
                      <button
                        type="button"
                        onClick={() => handleSetDefault(d.id)}
                        className="p-2 rounded-lg text-gray-500 hover:bg-white hover:text-amber-700"
                        title="Definir como padrão ao abrir o relatório"
                      >
                        <Star className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemove(d.id)}
                      className="p-2 rounded-lg text-red-600 hover:bg-red-50"
                      title="Remover"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

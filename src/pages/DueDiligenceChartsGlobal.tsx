/**
 * Preferências estruturais dos gráficos do PPT: mesmas para todos os leads (armazenadas no navegador).
 */
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Save, Palette, Loader2 } from 'lucide-react'
import type { AreaChartSlideStyle, AreaChartKindOverride, LeadPptAreaChartDefaults } from '@/lib/due-diligence/types'
import {
  DUE_DILIGENCE_GLOBAL_CHART_SLIDE_CATALOG,
  AREA_CHART_KIND_OPTIONS,
  globalCatalogAreaLabel,
  chartSlideSupportsKindPicker,
  type GlobalChartSlideCatalogEntry,
  type AreaChartPreviewSlide,
} from '@/lib/due-diligence/areaChartPreviews'
import {
  cloneDefaultStyle,
  applyStyleLayer,
  diffChartStyleFromDefault,
  diffChartStyleFromBase,
} from '@/lib/due-diligence/chartSlideStyles'
import { ChartStyleEditor } from '@/components/due-diligence/ChartStyleEditor'
import { ChartStructuralPreview, structuralPreviewKind } from '@/components/due-diligence/ChartStructuralPreview'
import { readStructuralChartDefaults, writeStructuralChartDefaults } from '@/lib/due-diligence/structuralChartDefaultsStorage'
import { cn } from '@/lib/utils'

function catalogEntryToPreviewSlide(e: GlobalChartSlideCatalogEntry): AreaChartPreviewSlide {
  return {
    id: e.id,
    defaultTitle: e.defaultTitle,
    description: '',
    kind: e.defaultKind,
    series: [
      { label: 'Série A', value: 42 },
      { label: 'Série B', value: 28 },
      { label: 'Série C', value: 15 },
    ],
    toggleable: e.supportsKindPicker,
  }
}

export function DueDiligenceChartsGlobal() {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [globalStyleFull, setGlobalStyleFull] = useState<AreaChartSlideStyle>(() => {
    const d = readStructuralChartDefaults()
    return applyStyleLayer(cloneDefaultStyle(), d?.chartGlobalStyle)
  })
  const [slidePartials, setSlidePartials] = useState<Record<string, Partial<AreaChartSlideStyle>>>(() => {
    const d = readStructuralChartDefaults()
    const out: Record<string, Partial<AreaChartSlideStyle>> = {}
    for (const e of DUE_DILIGENCE_GLOBAL_CHART_SLIDE_CATALOG) {
      const p = d?.chartSlideStyles?.[e.id]
      if (p && Object.keys(p).length > 0) out[e.id] = { ...p }
    }
    return out
  })
  const [kindsById, setKindsById] = useState<Partial<Record<string, AreaChartKindOverride>>>(() => {
    const d = readStructuralChartDefaults()
    return { ...(d?.chartSlideKinds ?? {}) }
  })
  const [titlesById, setTitlesById] = useState<Record<string, string>>(() => {
    const d = readStructuralChartDefaults()
    return { ...(d?.chartSlideTitles ?? {}) }
  })

  const patchGlobalStyle = (patch: Partial<AreaChartSlideStyle>) => {
    setGlobalStyleFull((prev) => applyStyleLayer(prev, patch))
  }

  const patchSlideStyle = (slideId: string, patch: Partial<AreaChartSlideStyle>) => {
    const currentEffective = applyStyleLayer(globalStyleFull, slidePartials[slideId])
    const nextEffective = applyStyleLayer(currentEffective, patch)
    const partial = diffChartStyleFromBase(nextEffective, globalStyleFull)
    setSlidePartials((prev) => {
      const n = { ...prev }
      if (Object.keys(partial).length === 0) delete n[slideId]
      else n[slideId] = partial
      return n
    })
  }

  const handleSave = () => {
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const mergedTitles: Record<string, string> = {}
      for (const e of DUE_DILIGENCE_GLOBAL_CHART_SLIDE_CATALOG) {
        const t = String(titlesById[e.id] ?? '').trim()
        if (t && t !== e.defaultTitle) mergedTitles[e.id] = t
      }

      const mergedKinds: Record<string, AreaChartKindOverride> = {}
      for (const e of DUE_DILIGENCE_GLOBAL_CHART_SLIDE_CATALOG) {
        if (!e.supportsKindPicker) continue
        const def = e.defaultKind as AreaChartKindOverride
        const chosen = kindsById[e.id] ?? def
        if (chosen !== def) mergedKinds[e.id] = chosen
      }

      const gdiff = diffChartStyleFromDefault(globalStyleFull)
      const mergedStyles: Record<string, Partial<AreaChartSlideStyle>> = {}
      for (const e of DUE_DILIGENCE_GLOBAL_CHART_SLIDE_CATALOG) {
        if (!e.supportsKindPicker) continue
        const partial = slidePartials[e.id]
        const eff = applyStyleLayer(globalStyleFull, partial)
        const diff = diffChartStyleFromBase(eff, globalStyleFull)
        if (Object.keys(diff).length > 0) mergedStyles[e.id] = diff
      }

      const payload: LeadPptAreaChartDefaults = {}
      if (Object.keys(gdiff).length > 0) payload.chartGlobalStyle = gdiff
      if (Object.keys(mergedKinds).length > 0) payload.chartSlideKinds = mergedKinds
      if (Object.keys(mergedStyles).length > 0) payload.chartSlideStyles = mergedStyles
      if (Object.keys(mergedTitles).length > 0) payload.chartSlideTitles = mergedTitles

      const clean = JSON.parse(JSON.stringify(Object.keys(payload).length ? payload : {})) as LeadPptAreaChartDefaults
      writeStructuralChartDefaults(Object.keys(clean).length ? clean : null)
      setSuccess('Preferências estruturais salvas neste navegador. Serão usadas em todos os leads ao gerar o PPT.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  const byArea = useMemo(() => {
    const m = new Map<string, GlobalChartSlideCatalogEntry[]>()
    for (const e of DUE_DILIGENCE_GLOBAL_CHART_SLIDE_CATALOG) {
      const arr = m.get(e.areaId) ?? []
      arr.push(e)
      m.set(e.areaId, arr)
    }
    return m
  }, [])

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          to="/due-diligence"
          className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar à Due Diligence
        </Link>
      </div>

      <div className="rounded-2xl border-2 border-gray-200 bg-white p-6 shadow-sm space-y-2">
        <div className="flex items-center gap-2 text-primary">
          <Palette className="h-6 w-6" />
          <h1 className="text-xl font-bold text-gray-900">Gráficos do PowerPoint (estrutura)</h1>
        </div>
        <p className="text-sm text-gray-600">
          Configuração única salva no seu navegador — vale para <strong>todos os leads</strong>. As preferências em
          &quot;Gráficos da área&quot; no lead continuam podendo sobrescrever por área.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      )}
      {success && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{success}</div>
      )}

      <div className="space-y-8">
        <section className="rounded-xl border border-gray-200 bg-gray-50/50 p-4 space-y-3">
          <h2 className="text-sm font-semibold text-gray-800">Estilo global (todas as áreas e slides)</h2>
          <ChartStyleEditor
            chartStyle={globalStyleFull}
            onPatch={patchGlobalStyle}
            summarySubtitle="Base antes dos ajustes por slide abaixo"
            onReset={() => setGlobalStyleFull(cloneDefaultStyle())}
            resetButtonLabel="Restaurar estilo padrão do sistema"
          />
        </section>

        {Array.from(byArea.entries()).map(([areaId, entries]) => (
          <section key={areaId} className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
            <h2 className="text-sm font-semibold text-primary border-b border-gray-100 pb-2">
              {globalCatalogAreaLabel(entries[0])}
            </h2>
            <div className="space-y-6">
              {entries.map((entry) => {
                const previewSlide = catalogEntryToPreviewSlide(entry)
                const supports = chartSlideSupportsKindPicker(previewSlide)
                const effectiveStyle = applyStyleLayer(globalStyleFull, slidePartials[entry.id])
                const displayTitle =
                  titlesById[entry.id] !== undefined && String(titlesById[entry.id]).trim() !== ''
                    ? String(titlesById[entry.id])
                    : entry.defaultTitle
                const visKind = structuralPreviewKind(previewSlide, kindsById)
                return (
                  <div key={entry.id} className="rounded-lg border border-gray-100 bg-slate-50/40 p-4 space-y-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-xs font-mono text-slate-500">{entry.id}</span>
                      <span className="text-sm font-medium text-slate-800">{displayTitle}</span>
                    </div>
                    <label className="block text-xs text-slate-600">
                      Título no PPT
                      <input
                        type="text"
                        className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                        value={titlesById[entry.id] ?? ''}
                        placeholder={entry.defaultTitle}
                        onChange={(e) => setTitlesById((prev) => ({ ...prev, [entry.id]: e.target.value }))}
                      />
                    </label>
                    {supports && (
                      <>
                        <label className="block text-xs text-slate-600">
                          Tipo de gráfico
                          <select
                            className="mt-1 w-full max-w-xs rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                            value={kindsById[entry.id] ?? (entry.defaultKind as AreaChartKindOverride)}
                            onChange={(e) =>
                              setKindsById((prev) => ({
                                ...prev,
                                [entry.id]: e.target.value as AreaChartKindOverride,
                              }))
                            }
                          >
                            {AREA_CHART_KIND_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <div>
                          <p className="text-xs font-medium text-slate-600 mb-1.5">Prévia</p>
                          <ChartStructuralPreview slide={previewSlide} visKind={visKind} chartStyle={effectiveStyle} />
                        </div>
                        <ChartStyleEditor
                          chartStyle={effectiveStyle}
                          onPatch={(patch) => patchSlideStyle(entry.id, patch)}
                          summarySubtitle="Só este slide (diff em relação ao global)"
                          onReset={() =>
                            setSlidePartials((prev) => {
                              const n = { ...prev }
                              delete n[entry.id]
                              return n
                            })
                          }
                          resetButtonLabel="Remover ajustes só deste slide"
                        />
                      </>
                    )}
                    {!supports && (
                      <p className="text-xs text-slate-500">Slide somente texto/tabela — sem tipo de gráfico.</p>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        ))}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className={cn(
              'inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-white text-sm font-medium shadow-sm',
              saving && 'opacity-60'
            )}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar neste navegador
          </button>
        </div>
      </div>
    </div>
  )
}

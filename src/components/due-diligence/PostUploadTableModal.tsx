/**
 * Modal pós-upload: grade editável das linhas parseadas antes de confirmar `done`.
 */
import { useMemo, useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import type { DueDiligenceAreaId } from '@/lib/due-diligence/types'
import { validateParsedRows } from '@/lib/due-diligence/parseExcel'
import { cn } from '@/lib/utils'

export interface PostUploadDraft {
  areaRowId: string
  areaId: DueDiligenceAreaId
  fileName: string
  fileUrl: string
  parsedData: { rows: Record<string, unknown>[]; columnMapping: Record<string, string> }
}

interface PostUploadTableModalProps {
  draft: PostUploadDraft
  onClose: () => void
  onConfirm: (rows: Record<string, unknown>[]) => Promise<void>
}

const MAX_VISIBLE_COLS = 12

export function PostUploadTableModal({ draft, onClose, onConfirm }: PostUploadTableModalProps) {
  const [rows, setRows] = useState<Record<string, unknown>[]>(() =>
    draft.parsedData.rows.map((r) => ({ ...r }))
  )
  const [saving, setSaving] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  const columns = useMemo(() => {
    const keys = new Set<string>()
    for (const r of rows) {
      Object.keys(r).forEach((k) => keys.add(k))
    }
    return Array.from(keys).slice(0, MAX_VISIBLE_COLS)
  }, [rows])

  const updateCell = (rowIndex: number, key: string, value: string) => {
    setRows((prev) => {
      const next = prev.map((r, i) => (i === rowIndex ? { ...r, [key]: value } : r))
      return next
    })
  }

  const addRow = () => {
    const empty: Record<string, unknown> = {}
    for (const c of columns) empty[c] = ''
    setRows((prev) => [...prev, empty])
  }

  const removeRow = (idx: number) => {
    setRows((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleConfirm = async () => {
    setLocalError(null)
    const validation = validateParsedRows(draft.areaId, rows)
    if (!validation.valid) {
      setLocalError(validation.message || 'Dados inválidos.')
      return
    }
    setSaving(true)
    try {
      await onConfirm(rows)
      onClose()
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-[95vw] max-h-[90vh] flex flex-col my-4">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Revisar dados importados</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {draft.fileName} — ajuste as células e confirme para concluir a área.
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg" disabled={saving}>
            <X className="h-5 w-5" />
          </button>
        </div>
        {localError && (
          <div className="mx-4 mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{localError}</div>
        )}
        <div className="flex-1 overflow-auto p-4">
          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-100 sticky top-0 z-10">
                <tr>
                  <th className="px-2 py-2 text-left font-semibold text-gray-700 w-10">#</th>
                  {columns.map((c) => (
                    <th key={c} className="px-2 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">
                      {c}
                    </th>
                  ))}
                  <th className="w-16 px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, ri) => (
                  <tr key={ri} className="border-t border-gray-100 hover:bg-gray-50/80">
                    <td className="px-2 py-1 text-gray-400">{ri + 1}</td>
                    {columns.map((c) => (
                      <td key={c} className="px-1 py-1">
                        <input
                          className="w-full min-w-[80px] px-1 py-1 border border-gray-200 rounded text-xs"
                          value={String(row[c] ?? '')}
                          onChange={(e) => updateCell(ri, c, e.target.value)}
                        />
                      </td>
                    ))}
                    <td className="px-1 py-1">
                      <button
                        type="button"
                        className="text-red-600 hover:underline text-[10px]"
                        onClick={() => removeRow(ri)}
                      >
                        excluir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            onClick={addRow}
            className="mt-3 text-sm text-primary font-medium hover:underline"
          >
            + Adicionar linha
          </button>
        </div>
        <div className="flex gap-2 justify-end px-4 py-3 border-t border-gray-200 bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm hover:bg-white"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={saving}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-primary hover:opacity-90',
              saving && 'opacity-60'
            )}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Confirmar e concluir área
          </button>
        </div>
      </div>
    </div>
  )
}

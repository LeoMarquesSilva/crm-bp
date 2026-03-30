import { Link } from 'react-router-dom'
import { Settings } from 'lucide-react'
import type { WppDestination } from '@/lib/wppDestinations'

export type WppRecipientPickerProps = {
  idPrefix: string
  destinations: WppDestination[]
  recipientId: string
  onRecipientIdChange: (id: string) => void
  manualNumber: string
  onManualNumberChange: (value: string) => void
  /** Se false, não mostra link para /config-whatsapp (ex.: telas já dentro da config) */
  showConfigLink?: boolean
  manualPlaceholder?: string
  className?: string
}

/**
 * Seletor de destino salvo (pessoa/grupo) + opção de digitar número ou JID manualmente.
 * Usar com `resolveRecipientNumber` no envio.
 */
export function WppRecipientPicker({
  idPrefix,
  destinations,
  recipientId,
  onRecipientIdChange,
  manualNumber,
  onManualNumberChange,
  showConfigLink = true,
  manualPlaceholder = '5511999999999 ou JID do grupo ...@g.us',
  className = '',
}: WppRecipientPickerProps) {
  return (
    <div className={className}>
      <label htmlFor={`${idPrefix}-recipient`} className="block text-sm font-medium text-gray-700 mb-1">
        Enviar para
      </label>
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <select
          id={`${idPrefix}-recipient`}
          value={recipientId}
          onChange={(e) => onRecipientIdChange(e.target.value)}
          className="flex-1 min-w-[200px] px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent bg-white"
        >
          {destinations.map((d) => (
            <option key={d.id} value={d.id}>
              {d.kind === 'grupo' ? '📢 ' : '👤 '}
              {d.label}
            </option>
          ))}
          <option value="manual">Outro número ou grupo (digitar)</option>
        </select>
        {showConfigLink && (
          <Link
            to="/config-whatsapp"
            className="text-sm font-medium text-primary hover:underline inline-flex items-center gap-1 whitespace-nowrap"
          >
            <Settings className="h-4 w-4 shrink-0" />
            Configurar
          </Link>
        )}
      </div>
      {recipientId === 'manual' && (
        <input
          id={`${idPrefix}-manual`}
          type="text"
          inputMode="text"
          autoComplete="off"
          value={manualNumber}
          onChange={(e) => onManualNumberChange(e.target.value)}
          placeholder={manualPlaceholder}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-primary focus:border-transparent"
        />
      )}
    </div>
  )
}

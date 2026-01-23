import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  resultCount?: number
}

export function SearchBar({ value, onChange, resultCount }: SearchBarProps) {
  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Buscar campos, instruções ou exemplos..."
          className={cn(
            'w-full pl-12 pr-12 py-3 rounded-xl border border-gray-200',
            'bg-white text-gray-900',
            'placeholder:text-gray-400',
            'focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
            'transition-all duration-280'
          )}
        />
        {value && (
          <button
            onClick={() => onChange('')}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Limpar busca"
          >
            <X className="h-4 w-4 text-gray-400" />
          </button>
        )}
      </div>
      {value && resultCount !== undefined && (
        <div className="mt-2 text-sm text-gray-600">
          {resultCount > 0 ? (
            <span className="text-primary font-medium">
              {resultCount} resultado{resultCount !== 1 ? 's' : ''} encontrado{resultCount !== 1 ? 's' : ''}
            </span>
          ) : (
            <span>Nenhum resultado encontrado</span>
          )}
        </div>
      )}
    </div>
  )
}

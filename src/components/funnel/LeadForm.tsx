import { useState, useRef, useEffect } from 'react'
import { Alert } from '@/components/ui/Alert'
import { CheckCircle2, Loader2, Info, AlertCircle, ChevronDown, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getSolicitanteOptions } from '@/data/teamAvatars'
import { syncDueDiligenceLeadsFromFunnel } from '@/lib/due-diligence/api'

function onlyDigits(s: string): string {
  return (s || '').replace(/\D/g, '')
}

function maskCPF(value: string): string {
  const d = onlyDigits(value).slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

function maskCNPJ(value: string): string {
  const d = onlyDigits(value).slice(0, 14)
  if (d.length <= 2) return d
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

interface RazaoSocialCNPJ {
  razao_social: string
  cnpj: string
  tipo_doc: 'cpf' | 'cnpj'
}

const AREAS_ANALISE_OPCOES = [
  'Cível',
  'Reestruturação',
  'Tributário',
  'Trabalhista',
  'Distressed Deals',
  'Societário e Contratos',
] as const

interface LeadFormProps {
  alerts?: string[]
}

export function LeadForm({ alerts = [] }: LeadFormProps) {
  const [formData, setFormData] = useState({
    solicitante: '',
    email: '',
    cadastrado_por: '',
    due_diligence: '',
    prazo_reuniao_due: '',
    horario_due: '',
    razao_social_cnpj: [{ razao_social: '', cnpj: '', tipo_doc: 'cnpj' as const }] as RazaoSocialCNPJ[],
    local_reuniao: '',
    data_reuniao: '',
    horario_reuniao: '',
    tipo_de_lead: '',
    indicacao: '',
    nome_indicacao: '',
    areas_analise: [] as string[],
  })

  const solicitanteOptions = getSolicitanteOptions()
  const [solicitanteDropdownOpen, setSolicitanteDropdownOpen] = useState(false)
  const solicitanteDropdownRef = useRef<HTMLDivElement>(null)
  const selectedSolicitante = formData.email ? solicitanteOptions.find((o) => o.emailBismarchi === formData.email) : null

  const [cadastradoPorDropdownOpen, setCadastradoPorDropdownOpen] = useState(false)
  const cadastradoPorDropdownRef = useRef<HTMLDivElement>(null)
  const selectedCadastradoPor = formData.cadastrado_por ? solicitanteOptions.find((o) => o.emailBismarchi === formData.cadastrado_por) : null

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (solicitanteDropdownRef.current && !solicitanteDropdownRef.current.contains(e.target as Node)) {
        setSolicitanteDropdownOpen(false)
      }
      if (cadastradoPorDropdownRef.current && !cadastradoPorDropdownRef.current.contains(e.target as Node)) {
        setCadastradoPorDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'warning' | 'error'>('success')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [showResultModal, setShowResultModal] = useState(false)
  const [resultType, setResultType] = useState<'success' | 'error'>('success')
  const [resultMessage, setResultMessage] = useState('')

  const formatarDataBrasileira = (dataISO: string) => {
    if (!dataISO || dataISO === 'A definir') {
      return dataISO
    }
    const data = new Date(dataISO + 'T00:00:00')
    return data.toLocaleDateString('pt-BR')
  }

  const enviarWebhook = async (dados: any) => {
    const webhook_urls = [
      'https://ia-n8n.a8fvaf.easypanel.host/webhook/cadastro-lead',
      `https://api.allorigins.win/raw?url=${encodeURIComponent('https://ia-n8n.a8fvaf.easypanel.host/webhook/cadastro-lead')}`,
      `https://corsproxy.io/?${encodeURIComponent('https://ia-n8n.a8fvaf.easypanel.host/webhook/cadastro-lead')}`,
    ]

    console.log('=== ENVIANDO PARA N8N ===')
    console.log('Dados:', JSON.stringify(dados, null, 2))

    for (let i = 0; i < webhook_urls.length; i++) {
      const url = webhook_urls[i]
      const isProxy = i > 0

      try {
        console.log(`Tentativa ${i + 1}: ${isProxy ? 'Proxy' : 'Direto'}`)

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(dados),
        })

        if (response.ok) {
          console.log(`✅ SUCESSO via ${isProxy ? 'proxy' : 'conexão direta'}!`)
          return true
        }
      } catch (error) {
        console.log(`❌ Falhou tentativa ${i + 1}:`, error)
        if (i === webhook_urls.length - 1) {
          console.log('🔍 Detalhes do último erro:', error)
        }
      }
    }

    console.log('❌ TODAS as tentativas falharam - dados salvos apenas localmente')
    return false
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSolicitanteSelect = (option: (typeof solicitanteOptions)[0]) => {
    setFormData((prev) => ({
      ...prev,
      solicitante: option.name,
      email: option.emailBismarchi,
    }))
    setSolicitanteDropdownOpen(false)
  }

  const handleCadastradoPorSelect = (option: (typeof solicitanteOptions)[0]) => {
    setFormData((prev) => ({
      ...prev,
      cadastrado_por: option.emailBismarchi,
    }))
    setCadastradoPorDropdownOpen(false)
  }

  const handleRazaoSocialChange = (index: number, field: 'razao_social' | 'cnpj', value: string) => {
    const newRazaoSocial = [...formData.razao_social_cnpj]
    if (field === 'razao_social') {
      newRazaoSocial[index].razao_social = value.toUpperCase()
    } else {
      newRazaoSocial[index].cnpj = value
    }
    setFormData((prev) => ({
      ...prev,
      razao_social_cnpj: newRazaoSocial,
    }))
  }

  const setTipoDoc = (index: number, tipo: 'cpf' | 'cnpj') => {
    const newRazaoSocial = [...formData.razao_social_cnpj]
    newRazaoSocial[index].tipo_doc = tipo
    const raw = onlyDigits(newRazaoSocial[index].cnpj)
    newRazaoSocial[index].cnpj = tipo === 'cpf' ? maskCPF(raw) : maskCNPJ(raw)
    setFormData((prev) => ({
      ...prev,
      razao_social_cnpj: newRazaoSocial,
    }))
  }

  const handleCnpjCpfChange = (index: number, value: string) => {
    const item = formData.razao_social_cnpj[index]
    const masked = item.tipo_doc === 'cpf' ? maskCPF(value) : maskCNPJ(value)
    handleRazaoSocialChange(index, 'cnpj', masked)
  }

  const addRazaoSocial = () => {
    setFormData((prev) => ({
      ...prev,
      razao_social_cnpj: [...prev.razao_social_cnpj, { razao_social: '', cnpj: '', tipo_doc: 'cnpj' }],
    }))
  }

  const removeRazaoSocial = (index: number) => {
    if (formData.razao_social_cnpj.length > 1) {
      const newRazaoSocial = formData.razao_social_cnpj.filter((_, i) => i !== index)
      setFormData((prev) => ({
        ...prev,
        razao_social_cnpj: newRazaoSocial,
      }))
    }
  }

  const toggleAreaAnalise = (area: string) => {
    setFormData((prev) => {
      const current = prev.areas_analise
      const next = current.includes(area) ? current.filter((a) => a !== area) : [...current, area]
      return { ...prev, areas_analise: next }
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setMessage('')
    if (formData.areas_analise.length === 0) {
      setMessage('Selecione pelo menos uma área de análise.')
      setMessageType('error')
      return
    }
    setShowConfirmModal(true)
  }

  const resumoConfirmacao = (() => {
    const dataReuniao = formData.data_reuniao ? formatarDataBrasileira(formData.data_reuniao) : 'A definir'
    const horarioReuniao = formData.horario_reuniao || 'A definir'
    const prazoDue = formData.prazo_reuniao_due ? formatarDataBrasileira(formData.prazo_reuniao_due) : '—'
    const horarioDue = formData.horario_due || '—'
    const cadastradoPorNome = selectedCadastradoPor?.name || formData.cadastrado_por || '—'
    const itens: { label: string; value: string }[] = [
      { label: 'Solicitante', value: formData.solicitante || '—' },
      { label: 'E-mail do solicitante', value: formData.email || '—' },
      { label: 'Cadastro realizado por', value: cadastradoPorNome },
      { label: 'Haverá Due Diligence?', value: formData.due_diligence || '—' },
    ]
    if (formData.due_diligence === 'Sim') {
      itens.push({ label: 'Prazo entrega Due', value: prazoDue }, { label: 'Horário entrega Due', value: horarioDue })
    }
    formData.razao_social_cnpj.forEach((item, i) => {
      const sufixo = formData.razao_social_cnpj.length > 1 ? ` ${i + 1}` : ''
      itens.push(
        { label: `Razão Social${sufixo}`, value: item.razao_social || '—' },
        { label: `CNPJ/CPF${sufixo}`, value: item.cnpj || '—' }
      )
    })
    itens.push(
      { label: 'Local da reunião', value: formData.local_reuniao || '—' },
      { label: 'Data da reunião', value: dataReuniao },
      { label: 'Horário da reunião', value: horarioReuniao },
      { label: 'Tipo de lead', value: formData.tipo_de_lead || '—' },
      { label: 'Áreas de análise', value: formData.areas_analise.length ? formData.areas_analise.join('; ') : '—' }
    )
    if (formData.tipo_de_lead === 'Indicação') {
      itens.push(
        { label: 'Indicação', value: formData.indicacao || '—' },
        { label: 'Nome da indicação', value: formData.nome_indicacao || '—' }
      )
    }
    return itens
  })()

  const confirmarEEnviar = async () => {
    setShowConfirmModal(false)
    setIsSubmitting(true)

    try {
      const dataReuniaoFormatada = formData.data_reuniao ? formatarDataBrasileira(formData.data_reuniao) : 'A definir'
      const horarioReuniao = formData.horario_reuniao || 'A definir'
      const dataHorarioReuniao =
        formData.data_reuniao && formData.horario_reuniao
          ? `${formatarDataBrasileira(formData.data_reuniao)} ${formData.horario_reuniao}`
          : 'A definir'

      const dadosParaEnvio = {
        id: Date.now().toString(),
        solicitante: formData.solicitante,
        email: formData.email,
        cadastrado_por: formData.cadastrado_por,
        razao_social_cnpj: formData.razao_social_cnpj.map((item) => ({
          razao_social: item.razao_social,
          cnpj: item.cnpj,
        })),
        prazo_reuniao_due: formData.prazo_reuniao_due ? formatarDataBrasileira(formData.prazo_reuniao_due) : 'A definir',
        horario_due: formData.horario_due || 'A definir',
        data_reuniao: dataReuniaoFormatada,
        horario_reuniao: horarioReuniao,
        data_horario_reuniao: dataHorarioReuniao,
        local_reuniao: formData.local_reuniao,
        indicacao: formData.indicacao,
        nome_indicacao: formData.nome_indicacao,
        tipo_de_lead: formData.tipo_de_lead,
        due_diligence: formData.due_diligence,
        areas_analise: formData.areas_analise,
        timestamp: new Date().toLocaleString('pt-BR'),
        origem: 'Bismarchi | Pires - Manual CRM',
      }

      const dadosExistentes = JSON.parse(localStorage.getItem('leads') || '[]')
      dadosExistentes.push(dadosParaEnvio)
      localStorage.setItem('leads', JSON.stringify(dadosExistentes))
      console.log('💾 Dados salvos no localStorage:', dadosParaEnvio)

      if (formData.due_diligence === 'Sim') {
        void syncDueDiligenceLeadsFromFunnel(
          formData.razao_social_cnpj.map((item) => ({
            razao_social: item.razao_social,
            cnpj: item.cnpj,
          })),
          formData.solicitante || null
        ).catch((err) => console.error('[Due Diligence] Falha ao sincronizar leads no Supabase:', err))
      }

      const webhookSucesso = await enviarWebhook(dadosParaEnvio)

      if (webhookSucesso) {
        setResultType('success')
        setResultMessage('Lead enviado com sucesso para o RD Station.')
        setFormData({
          solicitante: '',
          email: '',
          cadastrado_por: '',
          due_diligence: '',
          prazo_reuniao_due: '',
          horario_due: '',
          razao_social_cnpj: [{ razao_social: '', cnpj: '', tipo_doc: 'cnpj' }],
          local_reuniao: '',
          data_reuniao: '',
          horario_reuniao: '',
          tipo_de_lead: '',
          indicacao: '',
          nome_indicacao: '',
          areas_analise: [],
        })
      } else {
        setResultType('error')
        setResultMessage('Não foi possível enviar para o RD Station. Os dados foram salvos localmente. Verifique sua conexão ou tente novamente mais tarde.')
      }
      setShowResultModal(true)
    } catch (error) {
      console.error('Erro no processamento:', error)
      setResultType('error')
      setResultMessage('Ocorreu um erro ao cadastrar o lead. Os dados foram salvos localmente. Tente novamente.')
      setShowResultModal(true)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="bg-gradient-to-br from-white to-gray-50/50 border border-gray-200 rounded-xl shadow-lg overflow-hidden">
      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {message && (
          <Alert variant={messageType === 'success' ? 'success' : messageType === 'warning' ? 'warning' : 'error'}>
            {message}
          </Alert>
        )}

        {/* Alerts compactos e informativos */}
        {alerts && alerts.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1 space-y-1">
                {alerts.map((alert, index) => (
                  <p key={index} className="text-xs text-amber-800 leading-relaxed">
                    {alert}
                  </p>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Seção: Informações do Solicitante */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
            <div className="w-1 h-6 bg-primary rounded-full"></div>
            <h3 className="font-semibold text-gray-800">Informações do Solicitante</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative" ref={solicitanteDropdownRef}>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Solicitante <span className="text-red-500">*</span>
              </label>
              <input type="hidden" name="solicitante_email" value={formData.email} required />
              <button
                type="button"
                onClick={() => setSolicitanteDropdownOpen((o) => !o)}
                className={cn(
                  'w-full px-4 py-2.5 border rounded-lg text-left flex items-center gap-3 transition-all shadow-[0px_4px_12px_0px_rgba(0,0,0,0.15)]',
                  'focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
                  'border-gray-300 bg-white hover:bg-gray-50',
                  !selectedSolicitante && 'text-gray-500'
                )}
              >
                {selectedSolicitante ? (
                  <>
                    <img
                      src={selectedSolicitante.avatar}
                      alt=""
                      className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                    />
                    <span className="flex-1 font-medium text-gray-800">{selectedSolicitante.name}</span>
                  </>
                ) : (
                  <span className="flex-1">Selecione o solicitante</span>
                )}
                <ChevronDown
                  className={cn('h-4 w-4 text-gray-500 flex-shrink-0 transition-transform', solicitanteDropdownOpen && 'rotate-180')}
                />
              </button>
              {solicitanteDropdownOpen && (
                <ul className="absolute z-10 mt-1 w-full max-h-64 overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg py-1">
                  {solicitanteOptions.map((opt) => (
                    <li key={opt.email}>
                      <button
                        type="button"
                        onClick={() => handleSolicitanteSelect(opt)}
                        className={cn(
                          'w-full px-4 py-2.5 flex items-center gap-3 text-left hover:bg-primary/5 transition-colors',
                          opt.emailBismarchi === formData.email && 'bg-primary/5 text-primary'
                        )}
                      >
                        <img src={opt.avatar} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                        <span className="font-medium text-gray-800">{opt.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                E-mail do Solicitante <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                name="email"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all shadow-[0px_4px_12px_0px_rgba(0,0,0,0.15)] bg-gray-50"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="Preenchido ao selecionar o solicitante"
                required
                readOnly
              />
            </div>
          </div>

          <div className="relative" ref={cadastradoPorDropdownRef}>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Cadastro realizado por (e-mail) <span className="text-red-500">*</span>
            </label>
            <input type="hidden" name="cadastrado_por" value={formData.cadastrado_por} required />
            <button
              type="button"
              onClick={() => setCadastradoPorDropdownOpen((o) => !o)}
              className={cn(
                'w-full px-4 py-2.5 border rounded-lg text-left flex items-center gap-3 transition-all shadow-[0px_4px_12px_0px_rgba(0,0,0,0.15)]',
                'focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
                'border-gray-300 bg-white hover:bg-gray-50',
                !selectedCadastradoPor && 'text-gray-500'
              )}
            >
              {selectedCadastradoPor ? (
                <>
                  <img
                    src={selectedCadastradoPor.avatar}
                    alt=""
                    className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                  />
                  <span className="flex-1 font-medium text-gray-800">{selectedCadastradoPor.name}</span>
                  <span className="text-xs text-gray-500 truncate max-w-[140px]">{selectedCadastradoPor.emailBismarchi}</span>
                </>
              ) : (
                <span className="flex-1">Selecione quem realizou o cadastro</span>
              )}
              <ChevronDown
                className={cn('h-4 w-4 text-gray-500 flex-shrink-0 transition-transform', cadastradoPorDropdownOpen && 'rotate-180')}
              />
            </button>
            {cadastradoPorDropdownOpen && (
              <ul className="absolute z-10 mt-1 w-full max-h-64 overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg py-1">
                {solicitanteOptions.map((opt) => (
                  <li key={opt.email}>
                    <button
                      type="button"
                      onClick={() => handleCadastradoPorSelect(opt)}
                      className={cn(
                        'w-full px-4 py-2.5 flex items-center gap-3 text-left hover:bg-primary/5 transition-colors',
                        opt.emailBismarchi === formData.cadastrado_por && 'bg-primary/5 text-primary'
                      )}
                    >
                      <img src={opt.avatar} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                      <span className="font-medium text-gray-800">{opt.name}</span>
                      <span className="text-xs text-gray-500">{opt.emailBismarchi}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Seção: Due Diligence */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
            <div className="w-1 h-6 bg-primary rounded-full"></div>
            <h3 className="font-semibold text-gray-800">Due Diligence</h3>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Haverá Due Diligence? <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer px-4 py-2 rounded-lg border-2 border-gray-200 hover:border-primary transition-colors">
                <input
                  type="radio"
                  name="due_diligence"
                  value="Sim"
                  checked={formData.due_diligence === 'Sim'}
                  onChange={handleInputChange}
                  required
                  className="w-4 h-4 text-primary"
                />
                <span className="font-medium">Sim</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer px-4 py-2 rounded-lg border-2 border-gray-200 hover:border-primary transition-colors">
                <input
                  type="radio"
                  name="due_diligence"
                  value="Não"
                  checked={formData.due_diligence === 'Não'}
                  onChange={handleInputChange}
                  className="w-4 h-4 text-primary"
                />
                <span className="font-medium">Não</span>
              </label>
            </div>
          </div>

          {/* Campos condicionais para Due Diligence */}
          {formData.due_diligence === 'Sim' && (
            <div className="bg-blue-50 border-l-4 border-blue-500 rounded-lg p-4 space-y-4 animate-in slide-in-from-top-2 duration-200">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-4 w-4 text-blue-600" />
                <span className="text-xs font-semibold text-blue-900">Campos obrigatórios para Due Diligence</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Prazo de Entrega da Due Diligence
                  </label>
                  <input
                    type="date"
                    name="prazo_reuniao_due"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-[0px_4px_12px_0px_rgba(0,0,0,0.15)]"
                    value={formData.prazo_reuniao_due}
                    onChange={handleInputChange}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Horário de Entrega da Due Diligence
                  </label>
                  <input
                    type="time"
                    name="horario_due"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-[0px_4px_12px_0px_rgba(0,0,0,0.15)]"
                    value={formData.horario_due}
                    onChange={handleInputChange}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Seção: Dados da Empresa/Pessoa */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
            <div className="w-1 h-6 bg-primary rounded-full"></div>
            <h3 className="font-semibold text-gray-800">Dados da Empresa/Pessoa</h3>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Razão Social / Nome Completo e CNPJ/CPF <span className="text-red-500">*</span>
            </label>
            {formData.razao_social_cnpj.map((item, index) => (
              <div key={index} className="bg-gradient-to-br from-gray-50 to-white border-2 border-gray-200 rounded-xl p-5 mb-4 relative shadow-sm hover:shadow-md transition-shadow">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Razão Social / Nome Completo
                    </label>
                    <input
                      type="text"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all shadow-[0px_4px_12px_0px_rgba(0,0,0,0.15)] uppercase"
                      value={item.razao_social}
                      onChange={(e) => handleRazaoSocialChange(index, 'razao_social', e.target.value)}
                      placeholder="DIGITE EM MAIÚSCULO"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">CPF ou CNPJ <span className="text-red-500">*</span></label>
                    <div className="flex gap-2 mb-2">
                      <button
                        type="button"
                        onClick={() => setTipoDoc(index, 'cpf')}
                        className={cn(
                          'px-3 py-1.5 rounded-lg text-sm font-medium border-2 transition-colors',
                          item.tipo_doc === 'cpf'
                            ? 'bg-primary text-white border-primary'
                            : 'bg-white border-gray-300 text-gray-600 hover:border-primary/50'
                        )}
                      >
                        CPF
                      </button>
                      <button
                        type="button"
                        onClick={() => setTipoDoc(index, 'cnpj')}
                        className={cn(
                          'px-3 py-1.5 rounded-lg text-sm font-medium border-2 transition-colors',
                          item.tipo_doc === 'cnpj'
                            ? 'bg-primary text-white border-primary'
                            : 'bg-white border-gray-300 text-gray-600 hover:border-primary/50'
                        )}
                      >
                        CNPJ
                      </button>
                    </div>
                    <input
                      type="text"
                      inputMode="numeric"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all shadow-[0px_4px_12px_0px_rgba(0,0,0,0.15)]"
                      value={item.cnpj}
                      onChange={(e) => handleCnpjCpfChange(index, e.target.value)}
                      placeholder={item.tipo_doc === 'cpf' ? '000.000.000-00' : '00.000.000/0000-00'}
                      required
                    />
                  </div>
                </div>
                {formData.razao_social_cnpj.length > 1 && (
                  <button
                    type="button"
                    className="absolute top-4 right-4 px-3 py-1.5 bg-red-500 text-white text-xs rounded-lg hover:bg-red-600 transition-colors shadow-sm"
                    onClick={() => removeRazaoSocial(index)}
                  >
                    Remover
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              className="px-4 py-2.5 bg-primary/10 text-primary border-2 border-primary rounded-lg hover:bg-primary hover:text-white transition-all text-sm font-semibold"
              onClick={addRazaoSocial}
            >
              + Adicionar Empresa/Pessoa
            </button>
          </div>
        </div>

        {/* Seção: Áreas de análise */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
            <div className="w-1 h-6 bg-primary rounded-full"></div>
            <h3 className="font-semibold text-gray-800">Áreas de análise</h3>
          </div>
          <p className="text-sm text-gray-600">
            Selecione todas as áreas do escritório que estarão envolvidas neste caso. <span className="text-red-500">*</span>
          </p>
          <div className="flex flex-wrap gap-3">
            {AREAS_ANALISE_OPCOES.map((area) => (
              <label
                key={area}
                className={cn(
                  'flex items-center gap-2 cursor-pointer px-4 py-2.5 rounded-lg border-2 transition-colors',
                  formData.areas_analise.includes(area)
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-gray-200 hover:border-primary/50 text-gray-700'
                )}
              >
                <input
                  type="checkbox"
                  checked={formData.areas_analise.includes(area)}
                  onChange={() => toggleAreaAnalise(area)}
                  className="w-4 h-4 rounded text-primary focus:ring-primary"
                />
                <span className="font-medium">{area}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Seção: Reunião */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
            <div className="w-1 h-6 bg-primary rounded-full"></div>
            <h3 className="font-semibold text-gray-800">Reunião</h3>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Local da Reunião <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="local_reuniao"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all shadow-[0px_4px_12px_0px_rgba(0,0,0,0.15)]"
              value={formData.local_reuniao}
              onChange={handleInputChange}
              placeholder="Ex: Escritório Bismarchi | Pires, Online, Cliente"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Data da Reunião</label>
              <input
                type="date"
                name="data_reuniao"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all shadow-[0px_4px_12px_0px_rgba(0,0,0,0.15)]"
                value={formData.data_reuniao}
                onChange={handleInputChange}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Horário da Reunião</label>
              <input
                type="time"
                name="horario_reuniao"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all shadow-[0px_4px_12px_0px_rgba(0,0,0,0.15)]"
                value={formData.horario_reuniao}
                onChange={handleInputChange}
              />
            </div>
          </div>
        </div>

        {/* Seção: Tipo de Lead */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
            <div className="w-1 h-6 bg-primary rounded-full"></div>
            <h3 className="font-semibold text-gray-800">Tipo de Lead</h3>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Tipo de Lead <span className="text-red-500">*</span>
            </label>
            <select
              name="tipo_de_lead"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all bg-white shadow-[0px_4px_12px_0px_rgba(0,0,0,0.15)]"
              value={formData.tipo_de_lead}
              onChange={handleInputChange}
              required
            >
              <option value="">Selecione a classificação</option>
              <option value="Indicação">Indicação</option>
              <option value="Lead Ativa">Lead Ativa</option>
              <option value="Lead Digital">Lead Digital</option>
              <option value="Lead Passiva">Lead Passiva</option>
            </select>
          </div>

          {/* Campos condicionais para Indicação */}
          {formData.tipo_de_lead === 'Indicação' && (
            <div className="bg-purple-50 border-l-4 border-purple-500 rounded-lg p-4 space-y-4 animate-in slide-in-from-top-2 duration-200">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-4 w-4 text-purple-600" />
                <span className="text-xs font-semibold text-purple-900">Campos obrigatórios para Indicação</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Tipo de Indicação <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="indicacao"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all bg-white shadow-[0px_4px_12px_0px_rgba(0,0,0,0.15)]"
                    value={formData.indicacao}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="">Selecione o tipo</option>
                    <option value="Fundo">Fundo</option>
                    <option value="Consultor">Consultor</option>
                    <option value="Cliente">Cliente</option>
                    <option value="Contador">Contador</option>
                    <option value="Sindicatos">Sindicatos</option>
                    <option value="Conselhos profissionais">Conselhos profissionais</option>
                    <option value="Colaborador">Colaborador</option>
                    <option value="Outros parceiros">Outros parceiros</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Nome da Indicação <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="nome_indicacao"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all shadow-[0px_4px_12px_0px_rgba(0,0,0,0.15)]"
                    value={formData.nome_indicacao}
                    onChange={handleInputChange}
                    placeholder="Nome de quem indicou"
                    required
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Botão de Submit */}
        <div className="pt-4 border-t border-gray-200">
          <button
            type="submit"
            disabled={isSubmitting}
            className={cn(
              'w-full px-6 py-3.5 bg-gradient-to-r from-primary to-primary/90 text-white rounded-lg font-semibold',
              'hover:from-primary/90 hover:to-primary shadow-lg hover:shadow-xl transition-all',
              'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-lg',
              'flex items-center justify-center gap-2 transform hover:scale-[1.02] active:scale-[0.98]'
            )}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Processando...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-5 w-5" />
                <span>Cadastrar Lead</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Modal de confirmação */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowConfirmModal(false)}>
          <div
            className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col border border-gray-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-primary text-white">
              <h3 className="font-semibold text-lg">Confirmar dados do lead</h3>
              <button type="button" onClick={() => setShowConfirmModal(false)} className="p-1.5 rounded-lg hover:bg-white/20">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 text-sm">
              <p className="text-gray-600 mb-4">Confira as informações antes de enviar para o RD Station:</p>
              <dl className="space-y-2">
                {resumoConfirmacao.map((item, i) => (
                  <div key={i} className="flex gap-2">
                    <dt className="text-gray-500 font-medium min-w-[140px]">{item.label}:</dt>
                    <dd className="text-gray-900 break-words">{item.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="p-4 border-t border-gray-200 flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarEEnviar}
                className="px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary/90 font-medium flex items-center gap-2"
              >
                <CheckCircle2 className="h-4 w-4" />
                Confirmar e enviar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de resultado (sucesso/erro) */}
      {showResultModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowResultModal(false)}>
          <div
            className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-gray-200 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            {resultType === 'success' ? (
              <CheckCircle2 className="h-14 w-14 text-emerald-500 mx-auto mb-4" />
            ) : (
              <AlertCircle className="h-14 w-14 text-red-500 mx-auto mb-4" />
            )}
            <h3 className="font-semibold text-lg text-gray-900 mb-2">
              {resultType === 'success' ? 'Enviado com sucesso' : 'Erro no envio'}
            </h3>
            <p className="text-gray-600 text-sm mb-6">{resultMessage}</p>
            <button
              type="button"
              onClick={() => setShowResultModal(false)}
              className="w-full px-4 py-2.5 rounded-lg bg-primary text-white font-medium hover:bg-primary/90"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

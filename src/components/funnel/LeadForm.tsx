import { useState } from 'react'
import { Alert } from '@/components/ui/Alert'
import { CheckCircle2, Loader2, Info, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface RazaoSocialCNPJ {
  razao_social: string
  cnpj: string
}

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
    razao_social_cnpj: [{ razao_social: '', cnpj: '' }] as RazaoSocialCNPJ[],
    areas_analise: [] as string[],
    local_reuniao: '',
    data_reuniao: '',
    horario_reuniao: '',
    tipo_de_lead: '',
    indicacao: '',
    nome_indicacao: '',
  })

  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'warning' | 'error'>('success')
  const [isSubmitting, setIsSubmitting] = useState(false)

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
    const { name, value, type } = e.target
    const target = e.target as HTMLInputElement

    if (type === 'checkbox') {
      if (name === 'areas_analise') {
        setFormData((prev) => ({
          ...prev,
          areas_analise: target.checked
            ? [...prev.areas_analise, value]
            : prev.areas_analise.filter((area) => area !== value),
        }))
      }
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }))
    }
  }

  const handleRazaoSocialChange = (index: number, field: keyof RazaoSocialCNPJ, value: string) => {
    const newRazaoSocial = [...formData.razao_social_cnpj]
    newRazaoSocial[index][field] = value
    setFormData((prev) => ({
      ...prev,
      razao_social_cnpj: newRazaoSocial,
    }))
  }

  const addRazaoSocial = () => {
    setFormData((prev) => ({
      ...prev,
      razao_social_cnpj: [...prev.razao_social_cnpj, { razao_social: '', cnpj: '' }],
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setMessage('')

    try {
      const dadosParaEnvio = {
        id: Date.now().toString(),
        solicitante: formData.solicitante,
        email: formData.email,
        cadastrado_por: formData.cadastrado_por,
        razao_social_cnpj: formData.razao_social_cnpj,
        prazo_reuniao_due: formData.prazo_reuniao_due ? formatarDataBrasileira(formData.prazo_reuniao_due) : 'A definir',
        horario_due: formData.horario_due || 'A definir',
        data_reuniao: formData.data_reuniao ? formatarDataBrasileira(formData.data_reuniao) : 'A definir',
        horario_reuniao: formData.horario_reuniao || 'A definir',
        local_reuniao: formData.local_reuniao,
        indicacao: formData.indicacao,
        nome_indicacao: formData.nome_indicacao,
        tipo_de_lead: formData.tipo_de_lead,
        areas_analise: formData.areas_analise,
        due_diligence: formData.due_diligence,
        timestamp: new Date().toLocaleString('pt-BR'),
        origem: 'Bismarchi | Pires - Manual CRM',
      }

      // Salva no localStorage como backup
      const dadosExistentes = JSON.parse(localStorage.getItem('leads') || '[]')
      dadosExistentes.push(dadosParaEnvio)
      localStorage.setItem('leads', JSON.stringify(dadosExistentes))
      console.log('💾 Dados salvos no localStorage:', dadosParaEnvio)

      // Tenta enviar para o webhook
      const webhookSucesso = await enviarWebhook(dadosParaEnvio)

      if (webhookSucesso) {
        setMessage('✅ Lead cadastrado com sucesso e enviado para o sistema!')
        setMessageType('success')
      } else {
        setMessage('⚠️ Lead cadastrado com sucesso! Dados salvos localmente. O webhook pode ter problemas de CORS - verifique o console para detalhes.')
        setMessageType('warning')
      }

      // Limpa o formulário
      setFormData({
        solicitante: '',
        email: '',
        cadastrado_por: '',
        due_diligence: '',
        prazo_reuniao_due: '',
        horario_due: '',
        razao_social_cnpj: [{ razao_social: '', cnpj: '' }],
        areas_analise: [],
        local_reuniao: '',
        data_reuniao: '',
        horario_reuniao: '',
        tipo_de_lead: '',
        indicacao: '',
        nome_indicacao: '',
      })
    } catch (error) {
      console.error('Erro no processamento:', error)
      setMessage('❌ Ocorreu um erro ao cadastrar o lead. Dados salvos localmente. Tente novamente.')
      setMessageType('error')
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
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Solicitante <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="solicitante"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all shadow-[0px_4px_12px_0px_rgba(0,0,0,0.15)]"
                value={formData.solicitante}
                onChange={handleInputChange}
                placeholder="Nome completo"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                E-mail do Solicitante <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                name="email"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all shadow-[0px_4px_12px_0px_rgba(0,0,0,0.15)]"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="exemplo@email.com"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Cadastro realizado por (e-mail) <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              name="cadastrado_por"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all shadow-[0px_4px_12px_0px_rgba(0,0,0,0.15)]"
              value={formData.cadastrado_por}
              onChange={handleInputChange}
              placeholder="seu.email@bismarchipires.com.br"
              required
            />
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
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all shadow-[0px_4px_12px_0px_rgba(0,0,0,0.15)]"
                      value={item.razao_social}
                      onChange={(e) => handleRazaoSocialChange(index, 'razao_social', e.target.value)}
                      placeholder="Digite a razão social ou nome completo"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">CNPJ/CPF</label>
                    <input
                      type="text"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all shadow-[0px_4px_12px_0px_rgba(0,0,0,0.15)]"
                      value={item.cnpj}
                      onChange={(e) => handleRazaoSocialChange(index, 'cnpj', e.target.value)}
                      placeholder="00.000.000/0000-00 ou 000.000.000-00"
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

        {/* Seção: Áreas e Reunião */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
            <div className="w-1 h-6 bg-primary rounded-full"></div>
            <h3 className="font-semibold text-gray-800">Áreas e Reunião</h3>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Áreas Jurídicas Envolvidas <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {['Cível', 'Reestruturação', 'Tributário', 'Trabalhista', 'Distressed Deals', 'Societário e Contratos'].map(
                (area) => (
                  <label key={area} className="flex items-center gap-2 cursor-pointer p-3 rounded-lg border-2 border-gray-200 hover:border-primary hover:bg-primary/5 transition-all">
                    <input
                      type="checkbox"
                      name="areas_analise"
                      value={area}
                      checked={formData.areas_analise.includes(area)}
                      onChange={handleInputChange}
                      className="w-4 h-4 text-primary rounded"
                    />
                    <span className="text-sm font-medium">{area}</span>
                  </label>
                )
              )}
            </div>
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
    </div>
  )
}

/**
 * Página que incorpora o dashboard Power BI do CRM RD Station.
 * Acesso via /dashboard-bi
 *
 * O que podemos editar aqui:
 * - Largura/altura do iframe e do container
 * - URL do embed (reportId, ctid, parâmetros como navContentPaneEnabled, filter)
 * - Título e texto da página
 * - Padding, borda, sombra do container
 *
 * O relatório em si (gráficos, filtros, dados) é editado no Power BI Service.
 */
const POWER_BI_EMBED_URL =
  'https://app.powerbi.com/reportEmbed?reportId=ff07589f-3b16-47b3-96ab-e0c53c27545f&autoAuth=true&ctid=5411b7aa-53ee-4f05-bb25-dfca7a522fc2'

export function CrmDashboardBi() {
  return (
    <div className="flex flex-col h-full min-h-[calc(100vh-10rem)]">
      <div className="mb-3 flex-shrink-0">
        <h1 className="text-xl font-semibold text-gray-800">CRM Dashboard BI</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Indicadores do CRM RD Station (Power BI)
        </p>
      </div>
      <div className="flex-1 min-h-[calc(100vh-11rem)] rounded-xl overflow-hidden border border-gray-200 bg-white shadow-sm">
        <iframe
          title="Dashboard CRM RD"
          src={POWER_BI_EMBED_URL}
          className="w-full h-full min-h-[640px]"
          style={{ minHeight: 'calc(100vh - 11rem)' }}
          frameBorder="0"
          allowFullScreen
        />
      </div>
    </div>
  )
}

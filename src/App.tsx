import { useState, useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { useAppStore } from '@/stores/appStore'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { Banner } from '@/components/layout/Banner'
import { CrmPageTitle } from '@/components/layout/CrmPageTitle'
import { ProtectedGate } from '@/components/layout/ProtectedGate'
import { SalesFunnel } from '@/components/SalesFunnel'
import { PostFunnel } from '@/components/PostFunnel'
import { Login } from '@/pages/Login'
import { ValidacaoSheets } from '@/pages/ValidacaoSheets'
import { LeadsForaSLA } from '@/pages/LeadsForaSLA'
import { AnalisePlanilha } from '@/pages/AnalisePlanilha'
import { DueDiligence } from '@/pages/DueDiligence'
import { ConfigNotificacoesWpp } from '@/pages/ConfigNotificacoesWpp'
import { DueDiligenceChartsGlobal } from '@/pages/DueDiligenceChartsGlobal'
import { isAuthenticated } from '@/lib/auth'

function LayoutContent() {
  const { currentFunnel } = useAppStore()
  return currentFunnel === 'sales' ? <SalesFunnel /> : <PostFunnel />
}

function App() {
  const [loggedIn, setLoggedIn] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)
  const { pathname } = useLocation()
  const isDashboard = pathname === '/analise-planilha'
  const isDueDiligence = pathname === '/due-diligence' || pathname.startsWith('/due-diligence/')
  const isConfigWpp = pathname === '/config-whatsapp'
  const compactToolLayout = isDashboard || isDueDiligence || isConfigWpp

  useEffect(() => {
    setLoggedIn(isAuthenticated())
    setAuthChecked(true)
  }, [])

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-pulse text-gray-500">Carregando...</div>
      </div>
    )
  }

  if (!loggedIn) {
    return <Login onSuccess={() => setLoggedIn(true)} />
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      {!compactToolLayout && <Banner />}
      <div className="flex flex-1 overflow-hidden">
        {!compactToolLayout && <Sidebar />}
        <main
          className={
            compactToolLayout
              ? 'flex-1 overflow-auto bg-gradient-to-br from-gray-50 via-white to-gray-50/80'
              : 'flex-1 overflow-auto'
          }
        >
          <div
            className={
              compactToolLayout
                ? 'w-full min-h-full px-4 py-4 lg:px-6 lg:py-5'
                : 'max-w-7xl mx-auto p-6 lg:p-8'
            }
          >
            {(isDashboard || isConfigWpp) && <CrmPageTitle />}
            <Routes>
              <Route path="/" element={<LayoutContent />} />
              <Route path="/validacao" element={<ProtectedGate areaName="Validação"><ValidacaoSheets /></ProtectedGate>} />
              <Route path="/sla" element={<ProtectedGate areaName="SLA"><LeadsForaSLA /></ProtectedGate>} />
              <Route path="/analise-planilha" element={<ProtectedGate areaName="Dashboard"><AnalisePlanilha /></ProtectedGate>} />
              <Route path="/due-diligence" element={<ProtectedGate areaName="Due Diligence"><DueDiligence /></ProtectedGate>} />
              <Route
                path="/due-diligence/graficos"
                element={
                  <ProtectedGate areaName="Due Diligence">
                    <DueDiligenceChartsGlobal />
                  </ProtectedGate>
                }
              />
              <Route
                path="/config-whatsapp"
                element={
                  <ProtectedGate areaName="Notificações WhatsApp">
                    <ConfigNotificacoesWpp />
                  </ProtectedGate>
                }
              />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  )
}

export default App

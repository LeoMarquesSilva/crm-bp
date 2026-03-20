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
  const isDueDiligence = pathname === '/due-diligence'

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
      {!isDashboard && !isDueDiligence && <Banner />}
      <div className="flex flex-1 overflow-hidden">
        {!isDashboard && !isDueDiligence && <Sidebar />}
        <main
          className={
            isDashboard || isDueDiligence
              ? 'flex-1 overflow-auto bg-gradient-to-br from-gray-50 via-white to-gray-50/80'
              : 'flex-1 overflow-auto'
          }
        >
          <div
            className={
              isDashboard || isDueDiligence
                ? 'w-full min-h-full px-4 py-4 lg:px-6 lg:py-5'
                : 'max-w-7xl mx-auto p-6 lg:p-8'
            }
          >
            {isDashboard && <CrmPageTitle />}
            <Routes>
              <Route path="/" element={<LayoutContent />} />
              <Route path="/validacao" element={<ProtectedGate areaName="Validação"><ValidacaoSheets /></ProtectedGate>} />
              <Route path="/sla" element={<ProtectedGate areaName="SLA"><LeadsForaSLA /></ProtectedGate>} />
              <Route path="/analise-planilha" element={<ProtectedGate areaName="Dashboard"><AnalisePlanilha /></ProtectedGate>} />
              <Route path="/due-diligence" element={<ProtectedGate areaName="Due Diligence"><DueDiligence /></ProtectedGate>} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  )
}

export default App

import { Routes, Route, useLocation } from 'react-router-dom'
import { useAppStore } from '@/stores/appStore'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { Banner } from '@/components/layout/Banner'
import { SalesFunnel } from '@/components/SalesFunnel'
import { PostFunnel } from '@/components/PostFunnel'
import { ValidacaoSheets } from '@/pages/ValidacaoSheets'
import { CrmDashboardBi } from '@/pages/CrmDashboardBi'
import { LeadsForaSLA } from '@/pages/LeadsForaSLA'

function LayoutContent() {
  const { currentFunnel } = useAppStore()
  return currentFunnel === 'sales' ? <SalesFunnel /> : <PostFunnel />
}

function App() {
  const { pathname } = useLocation()
  const isDashboardBi = pathname === '/dashboard-bi'

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      <Banner />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <div
            className={
              isDashboardBi
                ? 'w-full h-full min-h-0 px-4 py-4 lg:px-6 lg:py-5'
                : 'max-w-7xl mx-auto p-6 lg:p-8'
            }
          >
            <Routes>
              <Route path="/" element={<LayoutContent />} />
              <Route path="/validacao" element={<ValidacaoSheets />} />
              <Route path="/sla" element={<LeadsForaSLA />} />
              <Route path="/dashboard-bi" element={<CrmDashboardBi />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  )
}

export default App

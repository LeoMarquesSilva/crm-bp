import { useAppStore } from '@/stores/appStore'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { Banner } from '@/components/layout/Banner'
import { SalesFunnel } from '@/components/SalesFunnel'
import { PostFunnel } from '@/components/PostFunnel'

function App() {
  const { currentFunnel } = useAppStore()

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      <Banner />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <div className="max-w-7xl mx-auto p-6 lg:p-8">
            {currentFunnel === 'sales' ? <SalesFunnel /> : <PostFunnel />}
          </div>
        </main>
      </div>
    </div>
  )
}

export default App

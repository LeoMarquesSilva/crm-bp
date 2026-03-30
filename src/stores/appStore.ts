import { create } from 'zustand'
import { FunnelType } from '@/types'

interface AppState {
  currentFunnel: FunnelType
  activeStep: string | null
  searchTerm: string
  setCurrentFunnel: (funnel: FunnelType) => void
  setActiveStep: (stepId: string | null) => void
  setSearchTerm: (term: string) => void
}

// Load from localStorage on init
const loadFromStorage = () => {
  try {
    const stored = localStorage.getItem('crm-bp-storage')
    if (stored) {
      const parsed = JSON.parse(stored)
      return {
        currentFunnel: parsed.currentFunnel || 'sales',
        activeStep: parsed.activeStep || null,
      }
    }
  } catch {
    // Ignore errors
  }
  return {
    currentFunnel: 'sales' as FunnelType,
    activeStep: null,
  }
}

const initialState = loadFromStorage()

export const useAppStore = create<AppState>((set) => ({
  ...initialState,
  searchTerm: '',
  setCurrentFunnel: (funnel) => {
    set({ currentFunnel: funnel })
    localStorage.setItem('crm-bp-storage', JSON.stringify({ currentFunnel: funnel, activeStep: useAppStore.getState().activeStep }))
  },
  setActiveStep: (stepId) => {
    set({ activeStep: stepId })
    localStorage.setItem('crm-bp-storage', JSON.stringify({ currentFunnel: useAppStore.getState().currentFunnel, activeStep: stepId }))
  },
  setSearchTerm: (term) => set({ searchTerm: term }),
}))

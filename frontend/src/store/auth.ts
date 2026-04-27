import { create } from 'zustand'

import type { Me } from '../types/auth'

type AuthState = {
  me: Me | null
  setMe: (me: Me | null) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  me: null,
  setMe: (me) => set({ me }),
}))

import { create } from 'zustand'

interface ToastState {
  mensaje: string | null
  show: (mensaje: string) => void
}

let timer: ReturnType<typeof setTimeout> | undefined

export const useToast = create<ToastState>((set) => ({
  mensaje: null,
  show: (mensaje) => {
    clearTimeout(timer)
    set({ mensaje })
    timer = setTimeout(() => set({ mensaje: null }), 2200)
  },
}))

export const toast = (m: string) => useToast.getState().show(m)

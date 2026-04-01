import { create } from 'zustand'

export interface FileInfo {
  name: string
  path: string
  extension: string
  size: number
}

export interface FormData {
  accountNumber: string
  accountLabel: string
  date: string
  fixedPart: string
  adjustablePart: string
}

const defaultFormData: FormData = {
  accountNumber: '',
  accountLabel: '',
  date: new Date().toISOString().slice(0, 10),
  fixedPart: '',
  adjustablePart: ''
}

interface AppState {
  // Folder paths
  sourceFolder: string | null
  destinationFolder: string | null
  setSourceFolder: (path: string | null) => void
  setDestinationFolder: (path: string | null) => void

  // File queue
  fileQueue: FileInfo[]
  currentIndex: number
  setFileQueue: (files: FileInfo[]) => void
  nextFile: () => void
  prevFile: () => void
  removeCurrentFile: () => void

  // Form data
  currentFormData: FormData
  setFormData: (data: Partial<FormData>) => void
  resetForm: () => void

  // PDF preview
  currentPdfPath: string | null
  setCurrentPdfPath: (path: string | null) => void

  // Processing state
  isProcessing: boolean
  setIsProcessing: (value: boolean) => void
}

export const useAppStore = create<AppState>((set, get) => ({
  sourceFolder: null,
  destinationFolder: null,
  setSourceFolder: (path) => set({ sourceFolder: path }),
  setDestinationFolder: (path) => set({ destinationFolder: path }),

  fileQueue: [],
  currentIndex: 0,
  setFileQueue: (files) => set({ fileQueue: files, currentIndex: 0 }),
  nextFile: () => {
    const { currentIndex, fileQueue } = get()
    if (currentIndex < fileQueue.length - 1) {
      set({ currentIndex: currentIndex + 1 })
    }
  },
  prevFile: () => {
    const { currentIndex } = get()
    if (currentIndex > 0) {
      set({ currentIndex: currentIndex - 1 })
    }
  },
  removeCurrentFile: () => {
    const { fileQueue, currentIndex } = get()
    const newQueue = fileQueue.filter((_, i) => i !== currentIndex)
    const newIndex = Math.min(currentIndex, Math.max(0, newQueue.length - 1))
    set({ fileQueue: newQueue, currentIndex: newIndex })
  },

  currentFormData: { ...defaultFormData },
  setFormData: (data) =>
    set((state) => ({
      currentFormData: { ...state.currentFormData, ...data }
    })),
  resetForm: () => set({ currentFormData: { ...defaultFormData, date: new Date().toISOString().slice(0, 10) } }),

  currentPdfPath: null,
  setCurrentPdfPath: (path) => set({ currentPdfPath: path }),

  isProcessing: false,
  setIsProcessing: (value) => set({ isProcessing: value })
}))

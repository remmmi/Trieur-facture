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
  amount: string
}

const defaultFormData: FormData = {
  accountNumber: '',
  accountLabel: '',
  date: new Date().toISOString().slice(0, 10),
  fixedPart: '',
  adjustablePart: '',
  amount: ''
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
  setCurrentIndex: (index: number) => void
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
  hasStarted: boolean
  setHasStarted: (value: boolean) => void
  isProcessing: boolean
  setIsProcessing: (value: boolean) => void
  aiProcessing: boolean
  setAiProcessing: (value: boolean) => void

  // Stamp position (ratio 0-1 relative to page size) and rotation (degrees)
  stampX: number
  stampY: number
  stampRotation: number
  setStampPosition: (x: number, y: number) => void
  setStampRotation: (degrees: number) => void

  // AI extracted supplier name (for auto-learn mapping)
  aiExtractedSupplier: string | null
  setAiExtractedSupplier: (name: string | null) => void

  // Ventilation
  ventilationEnabled: boolean
  setVentilationEnabled: (value: boolean) => void
  ventilationLines: { accountNumber: string; accountLabel: string; amount: string }[]
  setVentilationLines: (lines: { accountNumber: string; accountLabel: string; amount: string }[]) => void

  // File loading state (ensurePdf in progress)
  fileLoading: boolean
  setFileLoading: (value: boolean) => void

  // Ignored files (removed from queue without being deleted)
  ignoredFiles: string[]
  ignoreCurrentFile: () => void
}

export const useAppStore = create<AppState>((set, get) => ({
  sourceFolder: null,
  destinationFolder: null,
  setSourceFolder: (path) => set({ sourceFolder: path }),
  setDestinationFolder: (path) => set({ destinationFolder: path }),

  fileQueue: [],
  currentIndex: 0,
  setFileQueue: (files) => set({ fileQueue: files, currentIndex: 0 }),
  setCurrentIndex: (index) => {
    const { fileQueue } = get()
    if (index >= 0 && index < fileQueue.length) {
      set({
        currentIndex: index,
        currentFormData: { ...defaultFormData, date: new Date().toISOString().slice(0, 10) },
        aiExtractedSupplier: null,
        ventilationEnabled: false,
        ventilationLines: []
      })
    }
  },
  nextFile: () => {
    const { currentIndex, fileQueue } = get()
    if (currentIndex < fileQueue.length - 1) {
      set({
        currentIndex: currentIndex + 1,
        currentFormData: { ...defaultFormData, date: new Date().toISOString().slice(0, 10) },
        aiExtractedSupplier: null,
        ventilationEnabled: false,
        ventilationLines: []
      })
    }
  },
  prevFile: () => {
    const { currentIndex } = get()
    if (currentIndex > 0) {
      set({
        currentIndex: currentIndex - 1,
        currentFormData: { ...defaultFormData, date: new Date().toISOString().slice(0, 10) },
        aiExtractedSupplier: null,
        ventilationEnabled: false,
        ventilationLines: []
      })
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
  resetForm: () =>
    set({
      currentFormData: { ...defaultFormData, date: new Date().toISOString().slice(0, 10) },
      aiExtractedSupplier: null,
      ventilationEnabled: false,
      ventilationLines: []
    }),

  currentPdfPath: null,
  setCurrentPdfPath: (path) => set({ currentPdfPath: path }),

  hasStarted: false,
  setHasStarted: (value) => set({ hasStarted: value }),

  isProcessing: false,
  setIsProcessing: (value) => set({ isProcessing: value }),

  aiProcessing: false,
  setAiProcessing: (value) => set({ aiProcessing: value }),

  stampX: 0.03,
  stampY: 0.93,
  stampRotation: 5,
  setStampPosition: (x, y) => set({ stampX: x, stampY: y }),
  setStampRotation: (degrees) => set({ stampRotation: degrees }),

  aiExtractedSupplier: null,
  setAiExtractedSupplier: (name) => set({ aiExtractedSupplier: name }),

  ventilationEnabled: false,
  setVentilationEnabled: (value) => set({ ventilationEnabled: value }),
  ventilationLines: [],
  setVentilationLines: (lines) => set({ ventilationLines: lines }),

  fileLoading: false,
  setFileLoading: (value) => set({ fileLoading: value }),

  ignoredFiles: [],
  ignoreCurrentFile: () => {
    const { fileQueue, currentIndex } = get()
    const file = fileQueue[currentIndex]
    if (!file) return
    const newIgnored = [...get().ignoredFiles, file.path]
    const newQueue = fileQueue.filter((_, i) => i !== currentIndex)
    const newIndex = Math.min(currentIndex, Math.max(0, newQueue.length - 1))
    set({
      ignoredFiles: newIgnored,
      fileQueue: newQueue,
      currentIndex: newIndex,
      currentFormData: { ...defaultFormData, date: new Date().toISOString().slice(0, 10) },
      aiExtractedSupplier: null,
      ventilationEnabled: false,
      ventilationLines: []
    })
  }
}))

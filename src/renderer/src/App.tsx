import { useAppStore } from '@/store/useAppStore'
import { WelcomeScreen } from '@/components/WelcomeScreen'
import { Layout } from '@/components/Layout'

function App(): React.JSX.Element {
  const { currentPdfPath, fileQueue } = useAppStore()

  if (!currentPdfPath || fileQueue.length === 0) {
    return <WelcomeScreen />
  }

  return <Layout />
}

export default App

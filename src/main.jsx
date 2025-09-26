import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

console.log('🔍 MAIN: Script loaded successfully')
console.log('🔍 MAIN: React imported:', typeof StrictMode)
console.log('🔍 MAIN: createRoot imported:', typeof createRoot)

function EmergencyTest() {
  console.log('🔍 COMPONENT: Emergency test component rendering')
  
  return (
    <div style={{
      padding: '20px',
      background: 'linear-gradient(45deg, #ff6b6b, #4ecdc4)',
      color: 'white',
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      fontFamily: 'Arial, sans-serif'
    }}>
      <h1>🚨 EMERGENCY TEST - REACT IS WORKING!</h1>
      <p>If you can see this, React is mounting correctly.</p>
      <p>Current time: {new Date().toLocaleTimeString()}</p>
      <button onClick={() => alert('React events are working!')}>Test Click</button>
      <div style={{ marginTop: '20px', fontSize: '14px' }}>
        <p>✅ JavaScript executing</p>
        <p>✅ React imported</p>
        <p>✅ JSX transforming</p>
        <p>✅ Component rendering</p>
      </div>
    </div>
  )
}

try {
  console.log('🔍 MAIN: Getting root element...')
  const rootElement = document.getElementById('root')
  console.log('🔍 MAIN: Root element found:', !!rootElement)
  
  if (!rootElement) {
    throw new Error('Root element not found!')
  }
  
  console.log('🔍 MAIN: Creating React root...')
  const root = createRoot(rootElement)
  console.log('🔍 MAIN: Root created successfully')
  
  console.log('🔍 MAIN: Rendering component...')
  root.render(
    <StrictMode>
      <EmergencyTest />
    </StrictMode>
  )
  
  console.log('🔍 MAIN: React render complete!')
  
} catch (error) {
  console.error('🚨 CRITICAL ERROR:', error)
  document.body.innerHTML = `
    <div style="padding: 20px; background: red; color: white; font-family: Arial;">
      <h1>🚨 CRITICAL JAVASCRIPT ERROR DETECTED</h1>
      <p><strong>Error:</strong> ${error.message}</p>
      <p><strong>Stack:</strong></p>
      <pre style="white-space: pre-wrap; background: rgba(0,0,0,0.3); padding: 10px;">${error.stack}</pre>
      <p><strong>This error is preventing the login page from showing!</strong></p>
    </div>
  `
}

import { useState } from 'react'

function TestApp() {
  const [isAuthorized, setIsAuthorized] = useState(() => {
    console.log('🔍 TestApp: Initializing auth state...')
    console.log('🔍 TestApp: typeof window:', typeof window)
    
    if (typeof window === 'undefined') {
      console.log('🔍 TestApp: Window undefined, returning false')
      return false
    }
    
    const authValue = window.localStorage.getItem('aiSearchAuth')
    console.log('🔍 TestApp: localStorage auth value:', authValue)
    const result = authValue === 'true'
    console.log('🔍 TestApp: isAuthorized result:', result)
    return result
  })

  console.log('🔍 TestApp: Rendering with isAuthorized:', isAuthorized)

  if (!isAuthorized) {
    console.log('🔍 TestApp: Rendering login form')
    return (
      <div style={{ 
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(140deg, #082141, #001e4b)',
        color: 'white',
        fontFamily: 'Arial, sans-serif'
      }}>
        <div style={{
          padding: '2rem',
          background: 'rgba(255,255,255,0.1)',
          borderRadius: '10px',
          textAlign: 'center',
          maxWidth: '400px'
        }}>
          <h1>🔧 TEST LOGIN PAGE</h1>
          <p>This is the simplified test login page</p>
          <form onSubmit={(e) => {
            e.preventDefault()
            const password = e.target.password.value
            console.log('🔍 TestApp: Password attempt:', password)
            if (password === 'sporka2025') {
              console.log('🔍 TestApp: Correct password, setting auth')
              setIsAuthorized(true)
              localStorage.setItem('aiSearchAuth', 'true')
            } else {
              console.log('🔍 TestApp: Wrong password')
              alert('Wrong password')
            }
          }}>
            <input 
              type="password" 
              name="password"
              placeholder="Enter password" 
              style={{
                padding: '10px',
                margin: '10px',
                borderRadius: '5px',
                border: '1px solid #ccc',
                fontSize: '16px'
              }}
            />
            <button type="submit" style={{
              padding: '10px 20px',
              margin: '10px',
              borderRadius: '5px',
              border: 'none',
              background: '#ff6600',
              color: 'white',
              fontSize: '16px',
              cursor: 'pointer'
            }}>
              Login
            </button>
          </form>
          <p style={{ fontSize: '12px', color: '#ccc' }}>
            Current auth state: {isAuthorized ? 'AUTHORIZED' : 'NOT AUTHORIZED'}
          </p>
        </div>
      </div>
    )
  }

  console.log('🔍 TestApp: Rendering main app')
  return (
    <div style={{ padding: '20px', background: '#f0f0f0', minHeight: '100vh' }}>
      <h1>✅ MAIN APP (AUTHORIZED)</h1>
      <p>You are logged in successfully!</p>
      <button 
        onClick={() => {
          console.log('🔍 TestApp: Logging out')
          setIsAuthorized(false)
          localStorage.removeItem('aiSearchAuth')
        }}
        style={{
          padding: '10px 20px',
          background: '#dc3545',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          cursor: 'pointer'
        }}
      >
        Logout
      </button>
    </div>
  )
}

export default TestApp
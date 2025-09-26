import { useState, useEffect } from 'react'
import './App.css'

function AppMain() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const auth = localStorage.getItem('authenticated')
    if (auth === 'true') {
      setIsAuthenticated(true)
    }
    setIsLoading(false)
  }, [])

  const handleLogin = (e) => {
    e.preventDefault()
    if (password === 'sporka2025') {
      setIsAuthenticated(true)
      localStorage.setItem('authenticated', 'true')
      setError('')
    } else {
      setError('Nesprávné heslo')
    }
  }

  const handleLogout = () => {
    setIsAuthenticated(false)
    localStorage.removeItem('authenticated')
    setPassword('')
  }

  if (isLoading) {
    return (
      <div className="app">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Načítání...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="app">
        <div className="auth-container">
          <div className="auth-box">
            <h1>AI Intelligence Search</h1>
            <p>Profesionální nástroj pro inteligentní vyhledávání v dokumentech</p>
            <form onSubmit={handleLogin}>
              <div className="input-group">
                <label htmlFor="password">Heslo</label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Zadejte heslo"
                  required
                />
              </div>
              {error && <div className="error-message">{error}</div>}
              <button type="submit" className="login-btn">
                Přihlásit se
              </button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <div className="header">
        <h1>AI Intelligence Search</h1>
        <button onClick={handleLogout} className="logout-btn">
          Odhlásit se
        </button>
      </div>
      
      <div className="main-container">
        <div className="search-panel">
          <h2>Vyhledávání</h2>
          <div className="search-box">
            <input
              type="text"
              placeholder="Zadejte hledaný výraz..."
              className="search-input"
            />
            <button className="search-btn">Hledat</button>
          </div>
          
          <div className="search-results">
            <p>Sem se zobrazí výsledky vyhledávání...</p>
          </div>
        </div>
        
        <div className="document-panel">
          <h2>Dokument</h2>
          <div className="document-viewer">
            <p>Sem se načte dokument pro analýzu...</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AppMain
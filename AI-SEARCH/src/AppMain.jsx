import { useState, useEffect, useRef, useCallback } from 'react'
import './App.css'
import TableView from './components/TableView.jsx'
import { ExportSystem } from './exportSystem.js'
import { analyzeContractDocument } from './contractAnalyzer.js'

const exportSystem = new ExportSystem()

function AppMain() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  
  // Search and document state
  const [searchQuery, setSearchQuery] = useState('')
  const [documentText, setDocumentText] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [activeView, setActiveView] = useState('search') // 'search' or 'table'
  
  const fileInputRef = useRef(null)

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
    setSearchQuery('')
    setDocumentText('')
    setSearchResults([])
  }

  const handleFileUpload = (event) => {
    const file = event.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        setDocumentText(e.target.result)
      }
      reader.readAsText(file)
    }
  }

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim() || !documentText.trim()) return
    
    setIsSearching(true)
    try {
      // Basic search with contract analysis
      const results = await analyzeContractDocument(documentText, searchQuery)
      setSearchResults(results)
      setActiveView('table')
    } catch (error) {
      console.error('Search error:', error)
      setError('Chyba při vyhledávání')
    } finally {
      setIsSearching(false)
    }
  }, [searchQuery, documentText])

  const handleExport = async (format, selectedData) => {
    try {
      await exportSystem.exportData(format, selectedData, {
        documentTitle: `Analýza dokumentu - ${new Date().toLocaleDateString('cs-CZ')}`,
        includeMetadata: true
      })
    } catch (error) {
      console.error('Export error:', error)
      setError('Chyba při exportu dat')
    }
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
          <div className="auth-panel">
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
        <div className="header-actions">
          <div className="view-toggle">
            <button 
              className={`toggle-btn ${activeView === 'search' ? 'active' : ''}`}
              onClick={() => setActiveView('search')}
            >
              Vyhledávání
            </button>
            <button 
              className={`toggle-btn ${activeView === 'table' ? 'active' : ''}`}
              onClick={() => setActiveView('table')}
            >
              Tabulka ({searchResults.length})
            </button>
          </div>
          <button onClick={handleLogout} className="logout-btn">
            Odhlásit se
          </button>
        </div>
      </div>
      
      {error && (
        <div className="error-banner">
          {error}
          <button onClick={() => setError('')} className="error-close">×</button>
        </div>
      )}

      {activeView === 'search' ? (
        <div className="main-container">
          <div className="search-panel">
            <h2>Vyhledávání</h2>
            
            <div className="file-upload-section">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".txt,.docx,.pdf"
                style={{ display: 'none' }}
              />
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="upload-btn"
              >
                📁 Načíst dokument
              </button>
              {documentText && (
                <span className="file-status">
                  ✅ Dokument načten ({documentText.length} znaků)
                </span>
              )}
            </div>

            <div className="search-box">
              <input
                type="text"
                placeholder="Zadejte hledaný výraz..."
                className="search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
              <button 
                className="search-btn"
                onClick={handleSearch}
                disabled={isSearching || !searchQuery.trim() || !documentText.trim()}
              >
                {isSearching ? '🔍 Hledám...' : 'Hledat'}
              </button>
            </div>
            
            <div className="search-results">
              {searchResults.length > 0 ? (
                <div>
                  <h3>Výsledky hledání ({searchResults.length})</h3>
                  <div className="results-list">
                    {searchResults.slice(0, 10).map((result, index) => (
                      <div key={index} className="result-item">
                        <div className="result-label">{result.label || 'Výsledek'}</div>
                        <div className="result-value">{result.value}</div>
                        <div className="result-meta">
                          Spolehlivost: {Math.round((result.confidence || 0) * 100)}%
                        </div>
                      </div>
                    ))}
                  </div>
                  <button 
                    className="view-all-btn"
                    onClick={() => setActiveView('table')}
                  >
                    Zobrazit všechny v tabulce →
                  </button>
                </div>
              ) : (
                <p>Zatím žádné výsledky. Načtěte dokument a zadejte hledaný výraz.</p>
              )}
            </div>
          </div>
          
          <div className="document-panel">
            <h2>Dokument</h2>
            <div className="document-viewer">
              {documentText ? (
                <div className="document-content">
                  <div className="document-stats">
                    <span>📊 {documentText.length} znaků</span>
                    <span>📃 {documentText.split('\n').length} řádků</span>
                    <span>🔍 {searchResults.length} výsledků</span>
                  </div>
                  <pre className="document-text">
                    {documentText.substring(0, 2000)}
                    {documentText.length > 2000 && '...'}
                  </pre>
                </div>
              ) : (
                <div className="document-placeholder">
                  <p>📁 Klikněte na "Načíst dokument" pro analýzu</p>
                  <p>Podporované formáty: .txt, .docx, .pdf</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="table-container">
          <TableView
            searchResults={searchResults}
            onExport={handleExport}
            onResultClick={(result) => {
              setActiveView('search')
              setSearchQuery(result.value)
            }}
          />
        </div>
      )}
    </div>
  )
}

export default AppMain
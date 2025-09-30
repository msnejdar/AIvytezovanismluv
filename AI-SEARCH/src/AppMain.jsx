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
      <div className="auth-app">
        <div className="auth-glass-container">
          <div className="auth-glass-panel">
            <div className="auth-brand">
              <div className="auth-logo">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                  <path d="M24 4L44 14V34L24 44L4 34V14L24 4Z" stroke="url(#grad1)" strokeWidth="1.5" fill="none" opacity="0.4"/>
                  <circle cx="24" cy="24" r="8" fill="url(#grad2)" opacity="0.6"/>
                  <defs>
                    <linearGradient id="grad1" x1="4" y1="4" x2="44" y2="44">
                      <stop offset="0%" stopColor="#94a3b8" />
                      <stop offset="100%" stopColor="#475569" />
                    </linearGradient>
                    <linearGradient id="grad2" x1="16" y1="16" x2="32" y2="32">
                      <stop offset="0%" stopColor="#e2e8f0" />
                      <stop offset="100%" stopColor="#94a3b8" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
              <h1 className="auth-title">AI Intelligence Search</h1>
            </div>
            <form onSubmit={handleLogin} className="auth-form">
              <div className="auth-input-wrapper">
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Zadejte heslo"
                  className="auth-input"
                  required
                  autoFocus
                />
              </div>
              {error && <div className="auth-error">{error}</div>}
              <button type="submit" className="auth-btn">
                <span>Přihlásit se</span>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M4 10h12m-5-5l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="main-app">
      <button onClick={handleLogout} className="logout-glass-btn">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4m7 14l5-5-5-5m5 5H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {error && (
        <div className="error-toast">
          <span>{error}</span>
          <button onClick={() => setError('')}>×</button>
        </div>
      )}

      {activeView === 'search' ? (
        <div className="dual-pane-container">
          <div className="left-pane">
            <div className="pane-header">
              <h2 className="pane-title">Vyhledávání</h2>
            </div>

            <div className="search-input-group">
              <input
                type="text"
                placeholder="Co chcete vyhledat?"
                className="main-search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
              <button
                className="main-search-btn"
                onClick={handleSearch}
                disabled={isSearching || !searchQuery.trim() || !documentText.trim()}
              >
                {isSearching ? (
                  <svg className="spinner" width="20" height="20" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.25"/>
                    <path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"/>
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
                    <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                )}
              </button>
            </div>

            <div className="results-section">
              {searchResults.length > 0 ? (
                <>
                  <div className="results-header">
                    <span className="results-count">{searchResults.length} výsledků</span>
                    <button
                      className="view-table-link"
                      onClick={() => setActiveView('table')}
                    >
                      Zobrazit tabulku →
                    </button>
                  </div>
                  <div className="results-list">
                    {searchResults.slice(0, 8).map((result, index) => (
                      <div key={index} className="result-card">
                        <div className="result-label">{result.label || 'Výsledek'}</div>
                        <div className="result-value">{result.value}</div>
                        <div className="result-confidence">
                          <div className="confidence-bar">
                            <div
                              className="confidence-fill"
                              style={{width: `${Math.round((result.confidence || 0) * 100)}%`}}
                            />
                          </div>
                          <span className="confidence-text">
                            {Math.round((result.confidence || 0) * 100)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="results-empty-state">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" opacity="0.3">
                    <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  <p>Zadejte dotaz a vložte text pro vyhledávání</p>
                </div>
              )}
            </div>
          </div>

          <div className="right-pane">
            <div className="pane-header">
              <h2 className="pane-title">Dokument</h2>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".txt,.docx,.pdf"
                style={{ display: 'none' }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="upload-file-btn"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4m14-7l-5-5-5 5m5-5v12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Nahrát soubor
              </button>
            </div>

            <div className="document-area">
              <textarea
                placeholder="Vložte text dokumentu..."
                className="document-textarea"
                value={documentText}
                onChange={(e) => setDocumentText(e.target.value)}
              />
              {documentText && (
                <div className="document-stats-overlay">
                  <span>{documentText.length} znaků</span>
                  <span>•</span>
                  <span>{documentText.split('\n').length} řádků</span>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="table-view-container">
          <button
            className="back-to-search"
            onClick={() => setActiveView('search')}
          >
            ← Zpět na vyhledávání
          </button>
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
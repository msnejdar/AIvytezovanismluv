import { useState, useEffect, useRef, useCallback } from 'react'
import './App.css'
import TableView from './components/TableView.jsx'
import { ExportSystem } from './exportSystem.js'
import { aiSearch } from './aiSearch.js'
import { removeDiacritics } from './documentNormalizer.js'

const exportSystem = new ExportSystem()

function AppMain() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  // Search and document state
  const [searchQuery, setSearchQuery] = useState('')
  const [documentText, setDocumentText] = useState('')
  const [searchAnswer, setSearchAnswer] = useState(null) // AI answer
  const [searchHistory, setSearchHistory] = useState([]) // History for table
  const [isSearching, setIsSearching] = useState(false)
  const [showTable, setShowTable] = useState(false) // Show/hide table
  
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
    setSearchAnswer(null)
    setSearchHistory([])
    setShowTable(false)
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
    setSearchAnswer(null)
    setError('')

    try {
      // Call AI search with normalized text
      const result = await aiSearch(documentText, searchQuery)

      if (result.success) {
        setSearchAnswer(result.answer)

        // Add to history for table view
        const historyItem = {
          query: searchQuery,
          answer: result.answer,
          timestamp: new Date().toISOString(),
          confidence: result.confidence
        }
        setSearchHistory(prev => [historyItem, ...prev])
      } else {
        setError(result.error || 'Chyba při vyhledávání')
      }
    } catch (error) {
      console.error('Search error:', error)
      setError('Chyba při vyhledávání')
    } finally {
      setIsSearching(false)
    }
  }, [searchQuery, documentText])

  const handleExport = async (format, selectedData) => {
    try {
      // Convert history to table format
      const dataForExport = selectedData || searchHistory.map(item => ({
        label: item.query,
        value: item.answer,
        confidence: item.confidence
      }))

      await exportSystem.exportData(format, dataForExport, {
        documentTitle: `AI Vyhledávání - ${new Date().toLocaleDateString('cs-CZ')}`,
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

      {!showTable ? (
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

            {/* AI Answer displayed directly */}
            {searchAnswer && (
              <div className="ai-answer-section">
                <div className="ai-answer-header">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M9 11l3 3L22 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span>Výsledek:</span>
                </div>
                <div className="ai-answer-box">
                  {searchAnswer}
                </div>
              </div>
            )}

            {/* Show table button */}
            {searchHistory.length > 0 && (
              <button
                className="show-table-btn"
                onClick={() => setShowTable(true)}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="3" width="7" height="7" stroke="currentColor" strokeWidth="2" rx="1"/>
                  <rect x="14" y="3" width="7" height="7" stroke="currentColor" strokeWidth="2" rx="1"/>
                  <rect x="3" y="14" width="7" height="7" stroke="currentColor" strokeWidth="2" rx="1"/>
                  <rect x="14" y="14" width="7" height="7" stroke="currentColor" strokeWidth="2" rx="1"/>
                </svg>
                Zobrazit tabulku ({searchHistory.length})
              </button>
            )}
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
        <div className="table-view-wrapper">
          <div className="table-header">
            <button
              className="back-to-search"
              onClick={() => setShowTable(false)}
            >
              ← Zpět na vyhledávání
            </button>
            <h2 className="table-title">Historie vyhledávání ({searchHistory.length})</h2>
          </div>
          <TableView
            searchResults={searchHistory.map(item => ({
              label: item.query,
              value: item.answer,
              confidence: item.confidence
            }))}
            onExport={handleExport}
            onResultClick={(result) => {
              setShowTable(false)
              setSearchQuery(result.label)
              setSearchAnswer(result.value)
            }}
          />
        </div>
      )}
    </div>
  )
}

export default AppMain
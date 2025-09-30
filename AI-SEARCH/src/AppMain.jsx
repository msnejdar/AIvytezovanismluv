import { useState, useEffect, useRef, useCallback } from 'react'
import './App.css'
import TableView from './components/TableView.jsx'
import HighlightedText from './components/HighlightedText.jsx'
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
  const [highlightText, setHighlightText] = useState(null) // Text to highlight in document

  // Batch search state
  const [showBatchModal, setShowBatchModal] = useState(false)
  const [batchQueries, setBatchQueries] = useState([]) // Categorized queries
  const [selectedQueries, setSelectedQueries] = useState(new Set())
  const [batchProgress, setBatchProgress] = useState(null) // {current, total, currentQuery}

  const fileInputRef = useRef(null)
  const highlightedTextRef = useRef(null)

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

  const categorizeQueries = useCallback(async (queries) => {
    try {
      const response = await fetch('http://localhost:3001/api/categorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queries })
      })

      if (!response.ok) throw new Error('Categorization failed')

      const data = await response.json()
      return data.categories // [{category: "Identifikační údaje", items: ["Rodné číslo", ...]}, ...]
    } catch (error) {
      console.error('Categorization error:', error)
      // Fallback: všechny do kategorie "Ostatní"
      return [{ category: 'Ostatní', items: queries }]
    }
  }, [])

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim() || !documentText.trim()) return

    // Detect multi-line search (>5 lines)
    const lines = searchQuery.split('\n').map(line => line.trim()).filter(line => line.length > 0)

    if (lines.length > 5) {
      // Batch search mode
      setIsSearching(true)
      try {
        const categorized = await categorizeQueries(lines)
        setBatchQueries(categorized)

        // Pre-select all queries
        const allQueries = new Set()
        categorized.forEach(cat => {
          cat.items.forEach(item => allQueries.add(item))
        })
        setSelectedQueries(allQueries)

        setShowBatchModal(true)
      } catch (error) {
        setError('Chyba při kategorizaci dotazů')
      } finally {
        setIsSearching(false)
      }
      return
    }

    // Normal single search
    setIsSearching(true)
    setSearchAnswer(null)
    setError('')

    try {
      // Call AI search with normalized text
      const result = await aiSearch(documentText, searchQuery)

      if (result.success) {
        setSearchAnswer(result.answer)

        // Extract values for highlighting
        const valuesToHighlight = result.answer.type === 'multiple'
          ? result.answer.results.map(r => r.value)
          : [result.answer.value];
        setHighlightText(valuesToHighlight)

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
        setHighlightText(null)
      }
    } catch (error) {
      console.error('Search error:', error)
      setError('Chyba při vyhledávání')
    } finally {
      setIsSearching(false)
    }
  }, [searchQuery, documentText, categorizeQueries])

  const handleBatchSearch = useCallback(async () => {
    const selectedList = Array.from(selectedQueries)
    if (selectedList.length === 0) {
      setError('Nevybrali jste žádné položky')
      return
    }

    setShowBatchModal(false)
    setIsSearching(true)
    setBatchProgress({ current: 0, total: selectedList.length, currentQuery: '' })

    const results = []

    for (let i = 0; i < selectedList.length; i++) {
      const query = selectedList[i]
      setBatchProgress({ current: i + 1, total: selectedList.length, currentQuery: query })

      try {
        const result = await aiSearch(documentText, query)

        if (result.success) {
          results.push({
            query,
            answer: result.answer,
            timestamp: new Date().toISOString(),
            confidence: result.confidence
          })
        }

        // Pause between requests to avoid rate limiting
        if (i < selectedList.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 300))
        }
      } catch (error) {
        console.error(`Failed to search: ${query}`, error)
      }
    }

    setSearchHistory(prev => [...results, ...prev])
    setBatchProgress(null)
    setIsSearching(false)
    setShowTable(true) // Auto-show table
  }, [selectedQueries, documentText])

  const handleExport = async (format, selectedData) => {
    try {
      // Transform table data for export
      // selectedData is array from TableView with: {query, label, value, type, absoluteValue}
      const dataForExport = selectedData.map(row => ({
        query: row.query || '',
        label: row.label || '',
        value: row.value || '',
        type: row.type || '',
        absoluteValue: row.absoluteValue || '',
        confidence: 0.95,
        context: '',
        startPosition: 0,
        matchCount: 1,
        extractedAt: new Date().toISOString()
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
            {showBatchModal ? (
              // Batch search modal
              <div className="batch-modal">
                <div className="batch-header">
                  <h2 className="pane-title">Detekováno {batchQueries.reduce((sum, cat) => sum + cat.items.length, 0)} položek</h2>
                  <button
                    className="batch-close-btn"
                    onClick={() => setShowBatchModal(false)}
                    title="Zavřít"
                  >×</button>
                </div>

                <div className="batch-controls">
                  <button
                    className="batch-select-all-btn"
                    onClick={() => {
                      const allQueries = new Set()
                      batchQueries.forEach(cat => cat.items.forEach(item => allQueries.add(item)))
                      setSelectedQueries(allQueries)
                    }}
                  >
                    ✓ Vybrat vše
                  </button>
                  <button
                    className="batch-search-btn"
                    onClick={handleBatchSearch}
                    disabled={selectedQueries.size === 0}
                  >
                    Hledat vybrané ({selectedQueries.size})
                  </button>
                </div>

                <div className="batch-categories">
                  {batchQueries.map((category, catIndex) => (
                    <div key={catIndex} className="batch-category">
                      <div className="batch-category-header">
                        <input
                          type="checkbox"
                          checked={category.items.every(item => selectedQueries.has(item))}
                          onChange={(e) => {
                            const newSelected = new Set(selectedQueries)
                            if (e.target.checked) {
                              category.items.forEach(item => newSelected.add(item))
                            } else {
                              category.items.forEach(item => newSelected.delete(item))
                            }
                            setSelectedQueries(newSelected)
                          }}
                        />
                        <span className="batch-category-name">
                          {category.category} ({category.items.length})
                        </span>
                      </div>
                      <div className="batch-category-items">
                        {category.items.map((item, itemIndex) => (
                          <div key={itemIndex} className="batch-item">
                            <input
                              type="checkbox"
                              checked={selectedQueries.has(item)}
                              onChange={(e) => {
                                const newSelected = new Set(selectedQueries)
                                if (e.target.checked) {
                                  newSelected.add(item)
                                } else {
                                  newSelected.delete(item)
                                }
                                setSelectedQueries(newSelected)
                              }}
                            />
                            <span>{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : batchProgress ? (
              // Progress view
              <div className="batch-progress-view">
                <div className="pane-header">
                  <h2 className="pane-title">Hledám...</h2>
                </div>
                <div className="batch-progress-content">
                  <div className="progress-bar-container">
                    <div
                      className="progress-bar-fill"
                      style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
                    />
                  </div>
                  <div className="progress-text">
                    {batchProgress.current}/{batchProgress.total}
                  </div>
                  <div className="progress-current-query">
                    Aktuálně: "{batchProgress.currentQuery}"
                  </div>
                  <button
                    className="batch-cancel-btn"
                    onClick={() => {
                      setIsSearching(false)
                      setBatchProgress(null)
                    }}
                  >
                    Zrušit hledání
                  </button>
                </div>
              </div>
            ) : (
              // Normal search view
              <>
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
                  <span className="click-hint">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2"/>
                      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
                    </svg>
                    Klikněte pro zobrazení v textu
                  </span>
                </div>
                <div
                  className="ai-answer-box clickable"
                  onClick={() => {
                    if (highlightedTextRef.current) {
                      // Get all values to highlight
                      const valuesToHighlight = searchAnswer.type === 'multiple'
                        ? searchAnswer.results.map(r => r.value)
                        : [searchAnswer.value];
                      highlightedTextRef.current.scrollToHighlight(valuesToHighlight);
                    }
                  }}
                  title="Klikněte pro zobrazení v dokumentu"
                >
                  {searchAnswer.type === 'single' ? (
                    <div className="answer-single">{searchAnswer.value}</div>
                  ) : (
                    <div className="answer-multiple">
                      {searchAnswer.results.map((result, index) => (
                        <div
                          key={index}
                          className="answer-item"
                          onClick={(e) => {
                            e.stopPropagation(); // Prevent box click
                            if (highlightedTextRef.current) {
                              highlightedTextRef.current.scrollToHighlight([result.value]);
                            }
                          }}
                        >
                          <span className="bullet">•</span>
                          <span className="answer-label">{result.label}:</span>
                          <span className="answer-value">{result.value}</span>
                        </div>
                      ))}
                    </div>
                  )}
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
              </>
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
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="upload-file-btn"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4m14-7l-5-5-5 5m5-5v12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Nahrát soubor
                </button>
                {documentText && (
                  <button
                    onClick={() => {
                      setDocumentText('')
                      setSearchAnswer(null)
                      setSearchHistory([])
                      setHighlightText(null)
                      if (fileInputRef.current) fileInputRef.current.value = ''
                    }}
                    className="upload-file-btn"
                    title="Vymazat dokument"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Vymazat
                  </button>
                )}
              </div>
            </div>

            <div className="document-area">
              {documentText ? (
                <>
                  <div className="document-display">
                    <HighlightedText
                      ref={highlightedTextRef}
                      text={documentText}
                      highlight={highlightText}
                      onHighlightClick={() => {
                        console.log('Scrolled to highlight');
                      }}
                    />
                  </div>
                  <button
                    className="edit-document-btn"
                    onClick={() => {
                      setHighlightText(null);
                      // Focus would go here if we want to switch to edit mode
                    }}
                    title="Upravit dokument"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  {documentText && (
                    <div className="document-stats-overlay">
                      <span>{documentText.length} znaků</span>
                      <span>•</span>
                      <span>{documentText.split('\n').length} řádků</span>
                      {highlightText && (
                        <>
                          <span>•</span>
                          <span className="highlight-indicator">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="currentColor"/>
                            </svg>
                            Zvýrazněno
                          </span>
                        </>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <textarea
                  placeholder="Vložte text dokumentu..."
                  className="document-textarea"
                  value={documentText}
                  onChange={(e) => setDocumentText(e.target.value)}
                />
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
            searchResults={searchHistory}
            onExport={handleExport}
            onResultClick={(result) => {
              setShowTable(false)
              setSearchQuery(result.rawResult.query)
              setSearchAnswer(result.rawResult.answer)
              setHighlightText(
                result.rawResult.answer.type === 'multiple'
                  ? result.rawResult.answer.results.map(r => r.value)
                  : [result.rawResult.answer.value]
              )
            }}
          />
        </div>
      )}
    </div>
  )
}

export default AppMain
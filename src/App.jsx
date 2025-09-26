import { useState, useEffect, useRef, useMemo } from 'react'
import './App.css'

const removeDiacritics = (value = '') => {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

const buildNormalizedDocument = (text = '') => {
  let normalized = ''
  const segments = []
  let originalIndex = 0

  for (const char of text) {
    const normalizedChar = removeDiacritics(char)
    const normalizedParts = normalizedChar ? Array.from(normalizedChar) : [char]

    if (normalizedParts.length === 0) {
      normalizedParts.push(char)
    }

    normalizedParts.forEach((part) => {
      normalized += part.toLowerCase()
      segments.push({
        start: originalIndex,
        end: originalIndex + char.length
      })
    })

    originalIndex += char.length
  }

  return { normalized, segments }
}

const createDocumentSearcher = (text = '') => {
  const { normalized, segments } = buildNormalizedDocument(text)

  const findExact = (target = '') => {
    const term = removeDiacritics(String(target || '')).toLowerCase().trim()
    if (!term) return []

    const matches = []
    let searchIndex = 0

    while (searchIndex <= normalized.length - term.length) {
      const foundIndex = normalized.indexOf(term, searchIndex)
      if (foundIndex === -1) break

      const startSegment = segments[foundIndex]
      const endSegment = segments[foundIndex + term.length - 1]

      if (!startSegment || !endSegment) {
        searchIndex = foundIndex + 1
        continue
      }

      matches.push({
        start: startSegment.start,
        end: endSegment.end,
        text: text.slice(startSegment.start, endSegment.end)
      })

      searchIndex = foundIndex + 1
    }

    return matches
  }

  const findTokens = (target = '') => {
    const tokenMatches = []
    const tokenCandidates = (String(target || '').match(/[\p{L}\p{N}/]+/gu) || [])
      .map(token => token.trim())
      .filter(token => token.length > 0)

    const uniqueTokens = Array.from(new Set(tokenCandidates))

    uniqueTokens.forEach(token => {
      if (token.length >= 3 || /\d/.test(token)) {
        tokenMatches.push(...findExact(token))
      }
    })

    return tokenMatches
  }

  return { findExact, findTokens }
}

const dedupeRanges = (ranges = []) => {
  const seen = new Set()
  return ranges.filter(range => {
    if (!range || typeof range.start !== 'number' || typeof range.end !== 'number') {
      return false
    }
    const key = `${range.start}-${range.end}`
    if (seen.has(key)) return false
    seen.add(key)
    return range.end > range.start
  })
}

const stripEdgePunctuation = (value = '') => {
  return value
    .replace(/^[\s,.;:()\[\]{}<>-]+/, '')
    .replace(/[\s,.;:()\[\]{}<>-]+$/, '')
}

const detectHighlightTargets = ({ label, value, query }) => {
  const text = typeof value === 'string' ? value : ''
  const trimmedText = stripEdgePunctuation(text.trim())

  if (!trimmedText) {
    return []
  }

  const lowerLabel = (label || '').toLowerCase()
  const lowerText = trimmedText.toLowerCase()
  const lowerQuery = (query || '').toLowerCase()
  const targets = new Set()

  const addMatch = (candidate) => {
    if (!candidate) return
    const cleaned = stripEdgePunctuation(candidate.replace(/[“”"„]/g, '').replace(/\s+/g, ' ').trim())
    if (!cleaned) return
    targets.add(cleaned)
  }

  const addMatches = (regex, filter) => {
    const matches = trimmedText.match(regex)
    if (!matches) return
    matches.forEach(match => {
      const candidate = match.trim()
      if (!candidate) return
      if (typeof filter === 'function' && !filter(candidate)) {
        return
      }
      addMatch(candidate)
    })
  }

  const colonIndex = trimmedText.lastIndexOf(':')
  if (colonIndex !== -1 && colonIndex < trimmedText.length - 1) {
    const afterColon = trimmedText.slice(colonIndex + 1)
    const primarySegment = stripEdgePunctuation(afterColon.split(/[,;\n]/)[0])
    if (primarySegment) {
      addMatch(primarySegment)
    }
  }

  const wantsBirthNumber = /rodn[ée]/.test(lowerLabel) || /rodn[ée]/.test(lowerText) || /rodn[ée]/.test(lowerQuery)
  if (wantsBirthNumber) {
    addMatches(/\b\d{6}\/?\d{3,4}\b/g, candidate => {
      const normalized = candidate.replace(/\s+/g, '')
      return /^\d{6}\/\d{3,4}$/.test(normalized)
    })
  }

  const wantsParcelNumber = /parcel/.test(lowerLabel) || /parcela/.test(lowerText) || /parcel/.test(lowerQuery) || /pozemek/.test(lowerText)
  if (wantsParcelNumber) {
    addMatches(/\b\d+[A-Za-z]?\/\d+[A-Za-z]?\b/g, candidate => !/^\d{6}\/\d{3,4}$/.test(candidate.replace(/\s+/g, '')))
  }

  const wantsIdNumber = /číslo|identifik|id|op\b|občansk|listin|spis/i.test(label || '') || /číslo/.test(lowerText)
  if (wantsIdNumber) {
    addMatches(/\b\d{3,}[\w/-]*\b/g)
  }

  const wantsName = /jméno|osoba|prodávající|kupující|vlastník|dlužník/.test(lowerLabel) || /jméno|prodávající|kupující|pan|paní/.test(lowerText)
  if (wantsName) {
    addMatches(/[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][a-záčďéěíňóřšťúůýž]+\s+[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][a-záčďéěíňóřšťúůýž]+/g)
  }

  if (targets.size === 0) {
    addMatches(/\b\d{6}\/\d{3,4}\b/g)
  }

  return Array.from(targets)
}

const collectMatchesForTargets = (targets = [], searcher) => {
  if (!searcher || !Array.isArray(targets)) return []

  const normalizedTargets = Array.from(new Set(
    targets
      .map(target => (target === undefined || target === null) ? '' : String(target))
      .map(target => stripEdgePunctuation(target))
      .map(target => target.trim())
      .filter(Boolean)
  ))

  if (normalizedTargets.length === 0) return []

  let matches = []

  normalizedTargets.forEach(target => {
    const exactMatches = searcher.findExact(target)
    if (exactMatches.length > 0) {
      matches = matches.concat(exactMatches)
      return
    }

    const sanitized = stripEdgePunctuation(target.replace(/[“”"„]/g, '').replace(/\s+/g, ' ')).trim()
    if (sanitized && sanitized !== target) {
      const sanitizedMatches = searcher.findExact(sanitized)
      if (sanitizedMatches.length > 0) {
        matches = matches.concat(sanitizedMatches)
        return
      }
    }
  })

  matches = dedupeRanges(matches)

  if (matches.length === 0) {
    normalizedTargets.forEach(target => {
      matches = matches.concat(searcher.findTokens(target))
    })
    matches = dedupeRanges(matches)
  }

  return matches
}

const escapeHtml = (str = '') => {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const renderHighlightedDocument = (text = '', ranges = [], activeResultId = null) => {
  if (!ranges || ranges.length === 0) {
    return escapeHtml(text)
  }

  const sortedRanges = ranges
    .filter(range => range && typeof range.start === 'number' && typeof range.end === 'number' && range.end > range.start)
    .sort((a, b) => {
      if (a.start === b.start) return a.end - b.end
      return a.start - b.start
    })

  const merged = []

  sortedRanges.forEach(range => {
    const start = Math.max(0, Math.min(range.start, text.length))
    const end = Math.max(start, Math.min(range.end, text.length))

    if (merged.length > 0) {
      const last = merged[merged.length - 1]
      if (start <= last.end) {
        if (end <= last.end) {
          return
        }
        last.end = end
        return
      }
    }

    merged.push({
      start,
      end,
      id: range.id,
      resultId: range.resultId
    })
  })

  let currentIndex = 0
  let html = ''

  merged.forEach(range => {
    if (range.start > currentIndex) {
      html += escapeHtml(text.slice(currentIndex, range.start))
    }

    const segment = escapeHtml(text.slice(range.start, range.end))
    const isActive = activeResultId && range.resultId === activeResultId
    const className = isActive ? 'highlight active' : 'highlight'

    html += `<mark class="${className}" data-highlight-id="${range.id}"${range.resultId ? ` data-result-id="${range.resultId}"` : ''}>${segment}</mark>`

    currentIndex = range.end
  })

  if (currentIndex < text.length) {
    html += escapeHtml(text.slice(currentIndex))
  }

  return html
}

function App() {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchHistory, setSearchHistory] = useState([])
  const [documentText, setDocumentText] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [highlightRanges, setHighlightRanges] = useState([])
  const [activeResultId, setActiveResultId] = useState(null)
  const highlightedDocumentRef = useRef(null)

  const documentSearcher = useMemo(() => createDocumentSearcher(documentText), [documentText])

  const [isAuthorized, setIsAuthorized] = useState(() => {
    if (typeof window === 'undefined') {
      return false
    }
    return window.localStorage.getItem('aiSearchAuth') === 'true'
  })
  const [passwordInput, setPasswordInput] = useState('')
  const [authError, setAuthError] = useState('')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const savedAuth = window.localStorage.getItem('aiSearchAuth') === 'true'
    if (savedAuth) {
      setIsAuthorized(true)
    }
  }, [])

  const handleAuthorize = (e) => {
    e.preventDefault()
    if (passwordInput === 'sporka2025') {
      setIsAuthorized(true)
      setAuthError('')
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('aiSearchAuth', 'true')
      }
    } else {
      setAuthError('Nesprávné heslo. Zkuste to znovu.')
    }
  }

  const handleLogout = () => {
    setIsAuthorized(false)
    setPasswordInput('')
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('aiSearchAuth')
    }
  }

  const applySearchResults = (rawResults = []) => {
    if (!Array.isArray(rawResults) || rawResults.length === 0) {
      setSearchResults([])
      setHighlightRanges([])
      setActiveResultId(null)
      return
    }

    const timestamp = Date.now()

    const preparedResults = rawResults.map((result, index) => {
      const id = result.id || `${timestamp}-${index}`
      const label = result.label || null
      const value = result.value || result.content || ''
      const rawHighlight = result.highlight

      const highlightTargets = Array.isArray(rawHighlight)
        ? rawHighlight.filter(Boolean)
        : rawHighlight ? [rawHighlight].filter(Boolean) : []

      const detectedTargets = detectHighlightTargets({
        label,
        value,
        query: searchQuery
      })

      const combinedTargets = Array.from(new Set([
        ...highlightTargets,
        ...detectedTargets
      ]))

      const matches = combinedTargets.length > 0
        ? collectMatchesForTargets(combinedTargets, documentSearcher).map((match, matchIndex) => ({
            ...match,
            id: `${id}-match-${matchIndex}`,
            resultId: id
          }))
        : []

      return {
        ...result,
        id,
        matches
      }
    })

    setSearchResults(preparedResults)
    const combinedMatches = preparedResults.flatMap(result => result.matches || [])
    console.log('Setting highlight ranges:', combinedMatches.length, combinedMatches)
    setHighlightRanges(combinedMatches)
    setActiveResultId(null)
  }

  useEffect(() => {
    const savedHistory = localStorage.getItem('searchHistory')
    if (savedHistory) {
      setSearchHistory(JSON.parse(savedHistory))
    }
  }, [])

  const handleSearch = async () => {
    if (!searchQuery.trim() || !documentText.trim()) return

    setIsSearching(true)

    const newHistoryEntry = {
      query: searchQuery,
      timestamp: new Date().toISOString(),
      id: Date.now()
    }
    
    const updatedHistory = [newHistoryEntry, ...searchHistory].slice(0, 10)
    setSearchHistory(updatedHistory)
    localStorage.setItem('searchHistory', JSON.stringify(updatedHistory))

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: searchQuery,
          document: documentText
        })
      })

      const data = await response.json()
      
      if (response.ok && data.content && data.content[0]) {
        try {
          // Zkusíme parsovat JSON odpověď od Claude
          const claudeResponse = JSON.parse(data.content[0].text)
          
          if (claudeResponse.results && Array.isArray(claudeResponse.results)) {
            applySearchResults(claudeResponse.results)
          } else {
            // Fallback na původní formát
            applySearchResults([{
              id: Date.now(),
              label: claudeResponse.label || null,
              value: claudeResponse.result || data.content[0].text,
              highlight: claudeResponse.highlight || []
            }])
          }
        } catch (parseError) {
          // Pokud není JSON, zkusíme rozdělit odpověď na jednotlivé položky
          const responseText = data.content[0].text
          const parsedResults = parseSimpleResponse(responseText, documentText)
          
          if (parsedResults.length > 0) {
            applySearchResults(parsedResults)
          } else {
            applySearchResults([{
              id: Date.now(),
              value: responseText,
              highlight: []
            }])
          }
        }
      } else {
        // Vytvoříme správnou error zprávu z API odpovědi
        let errorMsg = 'Chyba při vyhledávání'
        if (data.error) {
          if (typeof data.error === 'object') {
            errorMsg = data.error.message || data.error.type || errorMsg
          } else {
            errorMsg = data.error
          }
        }
        throw new Error(errorMsg)
      }
    } catch (error) {
      console.error('Chyba při vyhledávání:', error)
      
      let errorMessage = 'Nastala neočekávaná chyba při vyhledávání.'
      
      if (error.message.includes('overloaded') || error.message.includes('Overloaded')) {
        errorMessage = 'Claude API je momentálně přetížené. Zkuste to prosím za chvilku.'
      } else if (error.message.includes('rate_limit')) {
        errorMessage = 'Překročen limit požadavků. Zkuste to prosím za chvilku.'
      } else if (error.message.includes('invalid_request')) {
        errorMessage = 'Neplatný požadavek. Zkontrolujte zadaný text.'
      } else if (error.message.includes('authentication')) {
        errorMessage = 'Problém s autentizací API klíče.'
      } else if (!navigator.onLine) {
        errorMessage = 'Nejste připojeni k internetu.'
      }
      
      // Pro demonstraci - pokud je API nedostupné, ukážeme demo výsledky
      if (documentText.length > 50) {
        const demoResults = createDemoResults(searchQuery, documentText)
        if (demoResults.length > 0) {
          applySearchResults(demoResults)
          return
        }
      }
      
      applySearchResults([{
        id: Date.now(),
        value: errorMessage,
        error: true,
        highlight: []
      }])
    } finally {
      setIsSearching(false)
    }
  }

  const handleHistoryClick = (query) => {
    setSearchQuery(query)
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSearch()
    }
  }

  const createDemoResults = (query, document) => {
    const results = []
    const queryLower = query.toLowerCase()
    
    // Hledáme různé typy údajů v dokumentu
    
    // Rodné čísla
    const birthNumbers = document.match(/\d{6}\/\d{3,4}/g)
    if (birthNumbers && (queryLower.includes('rodné') || queryLower.includes('číslo') || queryLower.includes('narození'))) {
      birthNumbers.forEach(bn => {
        results.push({
          label: 'Rodné číslo',
          value: bn,
          highlight: bn
        })
      })
    }
    
    // Telefony
    const phones = document.match(/(\+420\s?)?\d{3}\s?\d{3}\s?\d{3}/g)
    if (phones && (queryLower.includes('telefon') || queryLower.includes('mobil') || queryLower.includes('číslo'))) {
      phones.forEach(phone => {
        results.push({
          label: 'Telefon',
          value: phone.trim(),
          highlight: phone.trim()
        })
      })
    }
    
    // Jména (dvě slova začínající velkým písmenem)
    const names = document.match(/[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][a-záčďéěíňóřšťúůýž]+\s+[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][a-záčďéěíňóřšťúůýž]+/g)
    if (names && (queryLower.includes('jméno') || queryLower.includes('název') || queryLower.includes('osoba'))) {
      names.slice(0, 3).forEach(name => { // Max 3 jména
        results.push({
          label: 'Jméno',
          value: name,
          highlight: name
        })
      })
    }
    
    // Parcelní čísla
    const parcelNumbers = document.match(/\d+\/\d+/g)
    if (parcelNumbers && (queryLower.includes('parcela') || queryLower.includes('pozemek') || queryLower.includes('číslo'))) {
      parcelNumbers.forEach(pn => {
        if (!pn.match(/^\d{6}\/\d{3,4}$/)) { // Není rodné číslo
          results.push({
            label: 'Parcelní číslo',
            value: pn,
            highlight: pn
          })
        }
      })
    }
    
    return results.slice(0, 5) // Max 5 výsledků
  }

  const parseSimpleResponse = (responseText, document) => {
    const results = []
    
    // Nejdřív zkusíme najít různé typy údajů v odpovědi
    const lines = responseText.split('\n').filter(line => line.trim())
    
    for (const line of lines) {
      const trimmedLine = line.trim()
      
      // Pokus najít údaj v dokumentu
      const foundInDocument = document.toLowerCase().includes(trimmedLine.toLowerCase())
      
      if (foundInDocument && trimmedLine.length > 2) {
        // Určíme typ údaje na základě obsahu
        let label = 'Výsledek'
        
        if (/^\d{6}\/\d{3,4}$/.test(trimmedLine)) {
          label = 'Rodné číslo'
        } else if (/^(\+420\s?)?\d{3}\s?\d{3}\s?\d{3}$/.test(trimmedLine)) {
          label = 'Telefon'
        } else if (/^[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][a-záčďéěíňóřšťúůýž]+\s+[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][a-záčďéěíňóřšťúůýž]+$/i.test(trimmedLine)) {
          label = 'Jméno'
        } else if (/^\d+\/\d+$/.test(trimmedLine)) {
          label = 'Parcelní číslo'
        } else if (/^\d+$/.test(trimmedLine)) {
          label = 'Číslo'
        } else if (/^[A-Z0-9]+$/.test(trimmedLine)) {
          label = 'Kód'
        }
        
        results.push({
          label: label,
          value: trimmedLine,
          highlight: trimmedLine
        })
      }
    }
    
    // Pokud nenajdeme strukturované údaje, zkusíme rozdělit na řádky
    if (results.length === 0 && lines.length > 1) {
      lines.forEach((line, index) => {
        const trimmedLine = line.trim()
        if (trimmedLine.length > 0) {
          results.push({
            label: `Výsledek ${index + 1}`,
            value: trimmedLine,
            highlight: trimmedLine
          })
        }
      })
    }
    
    return results
  }

  const handleResultClick = (result) => {
    if (!result) {
      return
    }

    if (!result.matches || result.matches.length === 0) {
      setActiveResultId(null)
      setHighlightRanges([])
      return
    }

    const firstMatch = result.matches[0]
    if (!firstMatch) {
      return
    }

    setActiveResultId(result.id)
    setHighlightRanges(result.matches)

    requestAnimationFrame(() => {
      const container = highlightedDocumentRef.current
      if (!container) return

      const target = container.querySelector(`[data-highlight-id="${firstMatch.id}"]`)
      if (!target) return

      const containerRect = container.getBoundingClientRect()
      const targetRect = target.getBoundingClientRect()
      const offsetWithinContainer = (targetRect.top - containerRect.top) + container.scrollTop
      const desiredScrollTop = Math.max(offsetWithinContainer - (container.clientHeight / 2) + (targetRect.height / 2), 0)

      container.scrollTo({
        top: desiredScrollTop,
        behavior: 'smooth'
      })
    })
  }

  const highlightDocument = (text, ranges) => {
    if (!ranges || ranges.length === 0) {
      return escapeHtml(text)
    }

    // Always show all highlights, not just active ones
    const rangesWithSelection = Array.isArray(ranges)
      ? ranges.map(range => ({
          start: range.start,
          end: range.end,
          id: range.id,
          resultId: range.resultId
        }))
      : []

    return renderHighlightedDocument(text, rangesWithSelection, activeResultId)
  }

  if (!isAuthorized) {
    return (
      <div className="auth-container">
        <div className="auth-panel">
          <h1 className="auth-title">AI Intelligence Search</h1>
          <p className="auth-subtitle">Zadejte přístupové heslo pro vstup</p>
          <form className="auth-form" onSubmit={handleAuthorize}>
            <input
              type="password"
              className="auth-input"
              placeholder="Heslo"
              value={passwordInput}
              onChange={(e) => {
                setPasswordInput(e.target.value)
                setAuthError('')
              }}
            />
            {authError && <div className="auth-error">{authError}</div>}
            <button type="submit" className="auth-button">Vstoupit</button>
          </form>
          <span className="auth-powered">Powered by Claude</span>
        </div>
      </div>
    )
  }

  return (
    <div className="app-container">
      <div className="search-panel">
        <div className="search-header">
          <div className="porsche-badge">
            <div className="badge-text">AI Intelligence Search</div>
            <div className="badge-subtitle">Powered by Claude</div>
          </div>
        </div>
        
        <div className="search-input-container">
          <input
            type="text"
            className="search-input"
            placeholder="Zadejte vyhledávací dotaz..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={handleKeyPress}
          />
          <button 
            className="search-button"
            onClick={handleSearch}
            disabled={isSearching || !searchQuery.trim() || !documentText.trim()}
          >
            {isSearching ? (
              <div className="loading-spinner"></div>
            ) : (
              <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/>
                <path d="m21 21-4.35-4.35"/>
              </svg>
            )}
          </button>
        </div>

        {searchResults.length > 0 && (
          <div className="results-section">
            <div className="results-header">
              <h3 className="results-title">Výsledky</h3>
              {searchResults.some(r => (r.matches && r.matches.length > 0)) && (
                <button 
                  className="show-all-button"
                  onClick={() => {
                    const allMatches = searchResults.flatMap(result => result.matches || [])
                    setHighlightRanges(allMatches)
                    setActiveResultId(null)
                  }}
                >
                  Zobrazit vše
                </button>
              )}
            </div>
            <div className="results-container">
              {searchResults.map(result => (
                <div 
                  key={result.id} 
                  className={`result-item ${result.error ? 'result-error' : ''} ${(result.matches && result.matches.length > 0) ? 'clickable' : ''}`}
                  onClick={() => (result.matches && result.matches.length > 0) && handleResultClick(result)}
                >
                  {result.label && (
                    <div className="result-label">{result.label}</div>
                  )}
                  <div className={result.label ? 'result-value' : 'result-content'}>
                    {result.value ?? result.content}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="history-section">
          <div className="history-header">
            <h3 className="history-title">Historie vyhledávání</h3>
            {searchHistory.length > 0 && (
              <button 
                className="clear-history-button"
                onClick={() => {
                  setSearchHistory([])
                  localStorage.removeItem('searchHistory')
                }}
                title="Smazat historii"
              >
                <svg className="clear-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3,6 5,6 21,6"></polyline>
                  <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"></path>
                  <line x1="10" y1="11" x2="10" y2="17"></line>
                  <line x1="14" y1="11" x2="14" y2="17"></line>
                </svg>
              </button>
            )}
          </div>
          <div className="history-list">
            {searchHistory.length === 0 ? (
              <div className="history-empty">Zatím žádná historie</div>
            ) : (
              searchHistory.map(item => (
                <div 
                  key={item.id} 
                  className="history-item"
                  onClick={() => handleHistoryClick(item.query)}
                >
                  <span className="history-query">{item.query}</span>
                  <span className="history-time">
                    {new Date(item.timestamp).toLocaleTimeString('cs-CZ', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="content-panel">
        <div className="content-header">
          <h2 className="content-title">Dokument pro vyhledávání</h2>
          <div className="content-stats">
            {highlightRanges.length > 0 && (
              <button 
                className="edit-button"
                onClick={() => {
                  setHighlightRanges([])
                  setActiveResultId(null)
                }}
              >
                Upravit text
              </button>
            )}
          </div>
        </div>

        <div className="document-input-container">
          <textarea
            className="document-input"
            placeholder="Vložte nebo napište text dokumentu, ve kterém chcete vyhledávat..."
            value={documentText}
            onChange={(e) => setDocumentText(e.target.value)}
            style={{ display: highlightRanges.length > 0 ? 'none' : 'block' }}
          />
          {highlightRanges.length > 0 && (
            <div 
              className="document-highlighted"
              ref={highlightedDocumentRef}
              dangerouslySetInnerHTML={{
                __html: highlightDocument(documentText, highlightRanges)
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}

export default App

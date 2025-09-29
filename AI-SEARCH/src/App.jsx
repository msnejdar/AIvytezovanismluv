import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import './App.css'
import {
  createNormalizedDocument,
  findValueInNormalizedDocument,
  detectValueType,
  validators,
  normalizeValue,
  createDebouncedNormalizer,
  removeDiacritics,
  extractIndividualValues
} from './documentNormalizer'
import { 
  logger, 
  logSearch, 
  logValidation, 
  logMismatch,
  logNormalization,
  logPerformance,
  logError 
} from './logger'
import {
  findFuzzyMatches,
  advancedFuzzySearch,
  czechFuzzySearch,
  realtimeFuzzySearch
} from './fuzzySearch'
import {
  semanticSearch,
  intelligentSearch,
  expandQuery,
  detectIntent
} from './semanticSearch'
import {
  smartHighlight,
  renderAdvancedHighlights,
  mergeHighlightRanges,
  highlightLegalDocument
} from './advancedHighlighter'
import {
  analyzeContractDocument,
  searchContractDocument
} from './contractAnalyzer'
import {
  searchCache,
  globalDebouncer,
  performanceMonitor,
  initializeOptimizations,
  createQueryHash
} from './performanceOptimizer'
import {
  rankSearchResults,
  calculateRelevanceScore
} from './intelligentRanking'

// Helper function to derive context labels
const deriveContextLabel = (match, document) => {
  if (!match || !document) return 'Nalezeno'
  
  const context = document.substring(
    Math.max(0, match.start - 50),
    Math.min(document.length, match.end + 50)
  )
  
  // Simple label derivation based on context
  if (/rodné|birth/i.test(context)) return 'Rodné číslo'
  if (/cena|částka|amount|price/i.test(context)) return 'Částka'
  if (/jméno|název|name/i.test(context)) return 'Jméno'
  if (/telefon|phone/i.test(context)) return 'Telefon'
  if (/adresa|address/i.test(context)) return 'Adresa'
  if (/datum|date/i.test(context)) return 'Datum'
  
  const detectedType = detectValueType(match.text)
  switch (detectedType) {
    case 'birthNumber': return 'Rodné číslo'
    case 'amount': return 'Částka'
    case 'phone': return 'Telefon'
    case 'date': return 'Datum'
    case 'iban': return 'IBAN'
    case 'bankAccount': return 'Bankovní účet'
    default: return 'Nalezeno'
  }
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

  const wantsIdNumber = /číslo|identifik|id|op\b|občansk|listin|spis|cena|částka|zapla[tť]|úhrada|poplatek/i.test(label || '') || /číslo|cena|částka|zapla[tť]|úhrada|poplatek/.test(lowerText)
  if (wantsIdNumber) {
    const currencyMatches = trimmedText.match(/\d{1,3}(?:[\s\.\,]\d{3})*(?:[\.,]\d+)?\s*(?:Kč|CZK|eur|€)?/gi)
    if (currencyMatches) {
      currencyMatches.forEach(match => {
        const numericPart = match.replace(/[^0-9,\.]/g, '').replace(/,/g, '.')
        if (numericPart && /\d/.test(numericPart)) {
          addMatch(match.trim())
        }
      })
    }

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

const extractPrimaryNumeric = (text = '') => {
  if (!text) return null
  const currencyRegex = /(\d{1,3}(?:[\s\.\,]\d{3})*(?:[\.,]\d+)?)(\s*(?:Kč|CZK|eur|€))?/i
  const match = text.match(currencyRegex)
  if (match) {
    return match[0].trim()
  }

  const numericRegex = /\d+(?:[\.,]\d+)?/
  const fallbackMatch = text.match(numericRegex)
  if (fallbackMatch) {
    return fallbackMatch[0]
  }

  return null
}

const refineMatchText = (originalText = '', label, targets = []) => {
  if (!originalText) return originalText

  const wantsNumericOnly = /cena|částka|zapla[tť]|úhrada|poplatek|hodnota|výše/i.test(label || '') || targets.some(target => /cena|částka|zapla[tť]|úhrada|poplatek|hodnota|výše/i.test(target))

  if (wantsNumericOnly) {
    const numeric = extractPrimaryNumeric(originalText)
    if (numeric) {
      return numeric
    }
  }

  return originalText
}

const adjustMatchStart = (match, text, label, targets = []) => {
  if (!match) return match

  const refinedText = refineMatchText(match.text, label, targets)
  if (refinedText === match.text) {
    return match
  }

  const index = text.indexOf(refinedText, match.start)
  if (index === -1) {
    return match
  }

  return {
    ...match,
    start: index,
    end: index + refinedText.length,
    text: refinedText
  }
}

const sanitizeLabelText = (label = '') => {
  return String(label || '')
    .replace(/[*#`>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const normalizeComparisonValue = (value = '', label) => {
  const raw = String(value || '').trim()
  if (!raw) return ''

  const lower = raw.toLowerCase()

  if (/rodn[ée]|birth/i.test(label || '') || /^\d{6}\s*\/\s*\d{3,4}$/.test(lower.replace(/\s+/g, ''))) {
    return lower.replace(/\s+/g, '').replace(/(\d{6})(\d{3,4})/, '$1/$2')
  }

  if (/číslo účtu|účet|iban|account/i.test(label || '') || /\d+\s*\/\s*\d+/.test(lower)) {
    return lower.replace(/\s+/g, '')
  }

  if (/iban/i.test(lower)) {
    return lower.replace(/\s+/g, '')
  }

  if (/cena|částka|zapla[tť]|úhrada|poplatek|hodnota|výše|úrok|rpsn|rate|%|kč|czk|eur|€/i.test(label || '') || /%/.test(lower)) {
    const digits = lower.replace(/[^ -]/g, '') // remove diacritics already in doc
    const hasPercent = /%/.test(lower)
    const numeric = lower.replace(/[^0-9]/g, '')
    return hasPercent ? `${numeric}%` : numeric
  }

  return lower.replace(/\s+/g, '')
}

const digitsOnly = (value = '') => String(value || '').replace(/[^0-9]/g, '')

const expandRangeForLabel = (document, start, end, label) => {
  let newStart = start
  let newEnd = end

  if (/rodn[ée]|birth/i.test(label || '')) {
    while (newStart > 0 && /[\s]/.test(document[newStart - 1])) {
      newStart -= 1
    }
    while (newEnd < document.length && /[\s]/.test(document[newEnd])) {
      newEnd += 1
    }
    return { start: newStart, end: newEnd }
  }

  if (/číslo účtu|účet|iban|account/i.test(label || '')) {
    while (newStart > 0 && /[\s*]/.test(document[newStart - 1])) {
      newStart -= 1
    }
    while (newEnd < document.length && /[\s*]/.test(document[newEnd])) {
      newEnd += 1
    }
    return { start: newStart, end: newEnd }
  }

  if (/cena|částka|zapla[tť]|úhrada|poplatek|hodnota|výše|úrok|rpsn|rate|%/i.test(label || '')) {
    while (newStart > 0 && /[\s\.,]/.test(document[newStart - 1])) {
      newStart -= 1
    }
    while (newEnd < document.length && /[\s\.,-]/.test(document[newEnd])) {
      newEnd += 1
    }

    const currencyMatch = document.slice(newEnd).match(/^(Kč|CZK|eur|€)/i)
    if (currencyMatch) {
      newEnd += currencyMatch[0].length
    }

    return { start: newStart, end: newEnd }
  }

  return { start: newStart, end: newEnd }
}

const escapeRegExp = (value = '') => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const buildLoosePattern = (normalizedValue = '') => {
  return normalizedValue
    .split('')
    .map(char => `[\\s\\*_\.,:-]*${escapeRegExp(char)}`)
    .join('') + '[\\s\\*_\.,:-]*'
}

const findMatchesByValue = (value = '', label, document = '', normalizedDoc = null) => {
  if (!value || !document) return []
  
  // Detect value type
  const valueType = detectValueType(value)
  
  // Use pre-normalized document if available
  const normalized = normalizedDoc || createNormalizedDocument(document)
  
  // Find matches using normalized search
  const matches = findValueInNormalizedDocument(value, valueType, normalized, document)
  
  // Log validation for debugging
  if (matches.length > 0) {
    console.log('[Search] Found matches for value', { 
      value, 
      type: valueType,
      matchCount: matches.length,
      matches: matches.map(m => m.text)
    })
  }
  
  return matches
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

// ZJEDNODUŠENÁ FUNKCE PRO HIGHLIGHTOVÁNÍ
const renderHighlightedDocument = (text = '', ranges = []) => {
  if (!ranges || ranges.length === 0 || !text) {
    return escapeHtml(text)
  }

  // Jednoduchý přístup - zpracuj jeden po druhém
  let result = escapeHtml(text)
  
  // Seřaď ranges od konce aby se neposunuly indexy
  const sortedRanges = [...ranges]
    .filter(r => r && typeof r.start === 'number' && typeof r.end === 'number' && r.start < r.end)
    .sort((a, b) => b.start - a.start)
  
  // Aplikuj každý range
  sortedRanges.forEach((range, i) => {
    const start = Math.max(0, Math.min(range.start, text.length))
    const end = Math.max(start, Math.min(range.end, text.length))
    
    if (start < end) {
      const beforeText = result.substring(0, start)
      const highlightText = escapeHtml(text.substring(start, end))
      const afterText = result.substring(end)
      
      const markTag = `<mark class="highlight" style="background-color: yellow; padding: 2px;">${highlightText}</mark>`
      result = beforeText + markTag + afterText
    }
  })
  
  return result
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
  const [isDocumentPreparing, setIsDocumentPreparing] = useState(false)
  const [normalizedDocument, setNormalizedDocument] = useState(() => buildNormalizedDocument(''))
  const [searchMode, setSearchMode] = useState('contract') // 'simple', 'fuzzy', 'semantic', 'intelligent', 'contract'
  const [performanceStats, setPerformanceStats] = useState(null)
  const [theme, setTheme] = useState('dark')
  const [showFilters, setShowFilters] = useState(false)
  const [searchFilters, setSearchFilters] = useState({
    documentType: 'all',
    confidence: 'all',
    valueType: 'all',
    dateRange: 'all'
  })

  const documentSearcher = useMemo(() => createDocumentSearcher(documentText), [documentText])

  const [isAuthorized, setIsAuthorized] = useState(false)
  const [passwordInput, setPasswordInput] = useState('')
  const [authError, setAuthError] = useState('')
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [searchWarnings, setSearchWarnings] = useState([])

  useEffect(() => {
    // Check localStorage for saved authentication and theme
    try {
      const savedAuth = localStorage.getItem('aiSearchAuth') === 'true'
      const savedTheme = localStorage.getItem('aiSearchTheme') || 'dark'
      setIsAuthorized(savedAuth)
      setTheme(savedTheme)
      document.documentElement.setAttribute('data-theme', savedTheme)
    } catch (error) {
      console.error('Error checking localStorage:', error)
      setIsAuthorized(false)
    }
    
    // Initialize performance optimizations
    initializeOptimizations({
      enableMemoryWatch: true,
      enableCaching: true
    })
  }, [])

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(newTheme)
    document.documentElement.setAttribute('data-theme', newTheme)
    try {
      localStorage.setItem('aiSearchTheme', newTheme)
    } catch (error) {
      console.error('Error saving theme:', error)
    }
  }

  const handleFilterChange = (filterType, value) => {
    setSearchFilters(prev => ({
      ...prev,
      [filterType]: value
    }))
  }

  const getConfidenceLevel = (score) => {
    if (score >= 0.8) return 'high'
    if (score >= 0.5) return 'medium'
    return 'low'
  }

  const renderConfidenceMeter = (confidence, label = 'Confidence') => {
    const level = getConfidenceLevel(confidence)
    return (
      <div className="confidence-meter">
        <span className="confidence-label">{label}</span>
        <div className="confidence-bar">
          <div className={`confidence-fill ${level}`}></div>
        </div>
        <span className="confidence-label">{Math.round(confidence * 100)}%</span>
      </div>
    )
  }

  const renderSearchFilters = () => {
    if (!showFilters) return null

    return (
      <div className="search-filters-container">
        <div className="search-filters-header">
          <h3 className="search-filters-title">Advanced Filters</h3>
          <button 
            className="filters-toggle"
            onClick={() => setShowFilters(false)}
          >
            Hide Filters
          </button>
        </div>
        
        <div className="search-filters-grid">
          <div className="filter-group">
            <label className="filter-label">Document Type</label>
            <select 
              className="filter-select"
              value={searchFilters.documentType}
              onChange={(e) => handleFilterChange('documentType', e.target.value)}
            >
              <option value="all">All Types</option>
              <option value="contract">Contracts</option>
              <option value="legal">Legal Documents</option>
              <option value="invoice">Invoices</option>
              <option value="agreement">Agreements</option>
            </select>
          </div>
          
          <div className="filter-group">
            <label className="filter-label">Confidence Level</label>
            <select 
              className="filter-select"
              value={searchFilters.confidence}
              onChange={(e) => handleFilterChange('confidence', e.target.value)}
            >
              <option value="all">All Levels</option>
              <option value="high">High (80%+)</option>
              <option value="medium">Medium (50-80%)</option>
              <option value="low">Low (Below 50%)</option>
            </select>
          </div>
          
          <div className="filter-group">
            <label className="filter-label">Value Type</label>
            <select 
              className="filter-select"
              value={searchFilters.valueType}
              onChange={(e) => handleFilterChange('valueType', e.target.value)}
            >
              <option value="all">All Types</option>
              <option value="birth-number">Birth Numbers</option>
              <option value="amount">Amounts</option>
              <option value="name">Names</option>
              <option value="phone">Phone Numbers</option>
              <option value="date">Dates</option>
              <option value="address">Addresses</option>
            </select>
          </div>
          
          <div className="filter-group">
            <label className="filter-label">Date Range</label>
            <select 
              className="filter-select"
              value={searchFilters.dateRange}
              onChange={(e) => handleFilterChange('dateRange', e.target.value)}
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="year">This Year</option>
            </select>
          </div>
        </div>
        
        <div className="filter-chips">
          {Object.entries(searchFilters).map(([key, value]) => {
            if (value === 'all') return null
            return (
              <div key={key} className="filter-chip">
                {key}: {value}
                <button 
                  className="filter-chip-remove"
                  onClick={() => handleFilterChange(key, 'all')}
                >
                  ×
                </button>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // Debounced document normalization
  useEffect(() => {
    if (!documentText) {
      setIsDocumentPreparing(false)
      setNormalizedDocument(buildNormalizedDocument(''))
      return
    }

    setIsDocumentPreparing(true)
    logNormalization(documentText.length, documentText.length, 0)

    const timer = setTimeout(() => {
      const normalized = buildNormalizedDocument(removeDiacritics(documentText).toLowerCase())
      setNormalizedDocument(normalized)
      setIsDocumentPreparing(false)
    }, 10)

    return () => clearTimeout(timer)
  }, [documentText])

  const handleAuthorize = async (e) => {
    e.preventDefault()
    setIsAuthenticating(true)
    setAuthError('')
    
    // Add a small delay to show loading state
    await new Promise(resolve => setTimeout(resolve, 500))
    
    if (passwordInput === 'sporka2025') {
      setIsAuthorized(true)
      try {
        localStorage.setItem('aiSearchAuth', 'true')
      } catch (error) {
        console.error('Error saving to localStorage:', error)
      }
    } else {
      setAuthError('Nesprávné heslo. Zkuste to znovu.')
    }
    
    setIsAuthenticating(false)
  }

  const handleLogout = () => {
    setIsAuthorized(false)
    setPasswordInput('')
    try {
      localStorage.removeItem('aiSearchAuth')
    } catch (error) {
      console.error('Error removing from localStorage:', error)
    }
  }
  

  const applySearchResults = (rawResults = []) => {
    if (!Array.isArray(rawResults) || rawResults.length === 0) {
      setSearchResults([])
      setHighlightRanges([])
      setActiveResultId(null)
      setSearchWarnings([])
      return
    }

    const timestamp = Date.now()
    const warnings = []

    const preparedResults = rawResults.map((result, index) => {
      const id = result.id || `${timestamp}-${index}`
      const label = result.label || null
      const value = result.value || result.content || ''
      const rawHighlight = result.highlight

      // Validate AI-provided indices
      let matches = []
      
      if (typeof result.start === 'number' && typeof result.end === 'number') {
        const start = Math.max(0, Math.min(result.start, documentText.length))
        const end = Math.max(0, Math.min(result.end, documentText.length))
        const extractedText = documentText.slice(start, end)
        
        // Detect value type and validate
        const valueType = detectValueType(value)
        const isValid = !validators[valueType] || validators[valueType](extractedText)
        
        if (isValid && extractedText.trim()) {
          matches = [{
            start,
            end,
            text: extractedText,
            id: `${id}-match-0`,
            resultId: id
          }]
          
        }
      }

      if (matches.length === 0 && value) {
        const fallbackMatches = findMatchesByValue(value, label, documentText, normalizedDocument)
        matches = fallbackMatches.map((match, matchIndex) => ({
          start: match.start,
          end: match.end,
          text: match.text,
          id: `${id}-value-match-${matchIndex}`,
          resultId: id
        }))
        
        // Log warning if value not found
        if (matches.length === 0) {
          const warning = `Hodnota "${value}" (${label || 'bez popisku'}) nebyla nalezena v dokumentu`
          warnings.push(warning)
        }
      }

      const highlightTargets = Array.isArray(rawHighlight)
        ? rawHighlight.filter(Boolean)
        : rawHighlight ? [rawHighlight].filter(Boolean) : []

      const detectedTargets = detectHighlightTargets({
        label,
        value,
        query: searchQuery
      })

      const fallbackTargets = value && typeof value === 'string' ? [value] : []

      if (matches.length === 0) {
        const combinedTargets = Array.from(new Set(
          (detectedTargets.length > 0
            ? detectedTargets
            : (highlightTargets.length > 0 ? highlightTargets : fallbackTargets)
          ).filter(Boolean)
        ))

        const fallbackMatches = combinedTargets.length > 0
          ? collectMatchesForTargets(combinedTargets, documentSearcher).map((match, matchIndex) => {
              const adjustedMatch = adjustMatchStart(match, documentText, label, combinedTargets)
              return {
                ...match,
                ...adjustedMatch,
                text: refineMatchText(match.text, label, combinedTargets),
                id: `${id}-match-${matchIndex}`,
                resultId: id
              }
            })
          : []

        matches = fallbackMatches
      }
      
      // If still no matches, try to extract individual values from the response
      if (matches.length === 0 && value) {
        const extractedValues = extractIndividualValues(value, documentText)
        if (extractedValues.length > 0) {
          matches = extractedValues.map((extractedMatch, matchIndex) => ({
            start: extractedMatch.start,
            end: extractedMatch.end,
            text: extractedMatch.text,
            id: `${id}-extracted-${matchIndex}`,
            resultId: id
          }))
        }
      }

      const filteredMatches = matches.filter(match => {
        const candidateRaw = match.text || ''
        const normalizedCandidate = normalizeComparisonValue(candidateRaw, label)
        const normalizedValue = normalizeComparisonValue(value, label)

        if (!normalizedCandidate && !normalizedValue) {
          return false
        }

        if (normalizedValue && normalizedCandidate) {
          if (normalizedCandidate === normalizedValue) {
            return true
          }

          return normalizeComparisonValue(candidateRaw.replace(/^[^0-9]+|[^0-9]+$/g, ''), label) === normalizedValue
        }

        return Boolean(normalizedCandidate)
      })

      const primaryMatch = filteredMatches[0]
      const finalLabel = sanitizeLabelText(label) || (primaryMatch ? deriveContextLabel(primaryMatch, documentText) : null) || 'Výsledek'

      return {
        ...result,
        id,
        label: finalLabel,
        value: value || (primaryMatch ? primaryMatch.text : ''),
        matches: filteredMatches
      }
    })

    setSearchResults(preparedResults)
    const combinedMatches = preparedResults.flatMap(result => result.matches || [])
    setHighlightRanges(combinedMatches)
    setActiveResultId(null)
    setSearchWarnings(warnings)
  }

  useEffect(() => {
    const savedHistory = localStorage.getItem('searchHistory')
    if (savedHistory) {
      setSearchHistory(JSON.parse(savedHistory))
    }
  }, [])

  // Enhanced intelligent search function
  const performIntelligentSearch = async () => {
    if (!searchQuery.trim() || !documentText.trim()) return
    
    const timerId = performanceMonitor.startTimer('intelligent-search', {
      queryLength: searchQuery.length,
      documentLength: documentText.length,
      mode: searchMode
    })
    
    try {
      let results = []
      
      switch (searchMode) {
        case 'fuzzy': {
          const fuzzyResults = czechFuzzySearch(searchQuery, documentText, {
            minScore: 0.6,
            maxResults: 10,
            contextLength: 50
          })
          
          results = fuzzyResults.map((match, index) => ({
            id: `fuzzy-${Date.now()}-${index}`,
            label: `Fuzzy match (${(match.score * 100).toFixed(1)}%)`,
            value: match.text,
            matches: [{
              start: match.start,
              end: match.end,
              text: match.text,
              score: match.score,
              confidence: match.score,
              id: `fuzzy-match-${index}`,
              resultId: `fuzzy-${Date.now()}-${index}`
            }]
          }))
          break
        }
        
        case 'semantic': {
          const semanticResults = intelligentSearch(searchQuery, documentText, {
            maxResults: 10,
            minScore: 0.3,
            contextWindow: 100
          })
          
          results = semanticResults.map((result, index) => ({
            id: `semantic-${Date.now()}-${index}`,
            label: `Semantic match (${result.primaryIntent})`,
            value: result.matches[0]?.term || 'No match',
            matches: result.matches.map((match, mIndex) => ({
              start: match.start || 0,
              end: match.end || 0,
              text: match.term,
              score: match.score,
              confidence: match.score,
              id: `semantic-match-${index}-${mIndex}`,
              resultId: `semantic-${Date.now()}-${index}`
            }))
          }))
          break
        }
        
        case 'contract': {
          // Contract-specific intelligent search
          const contractResults = searchContractDocument(documentText, searchQuery, {
            maxResults: 10,
            confidenceThreshold: 0.5
          });
          
          results = contractResults.results.map((match, index) => ({
            id: `contract-${Date.now()}-${index}`,
            label: match.label,
            value: match.value,
            type: match.type,
            confidence: match.confidence,
            context: match.context,
            matches: [{
              start: match.start,
              end: match.end,
              text: match.value,
              score: match.confidence,
              confidence: match.confidence,
              type: match.type,
              id: `contract-match-${index}`,
              resultId: `contract-${Date.now()}-${index}`
            }]
          }));
          break;
        }
        
        case 'intelligent':
        default: {
          // Combine multiple search strategies
          const normalizedDoc = normalizedDocument || createNormalizedDocument(documentText)
          
          // 1. Exact matches
          const exactMatches = findValueInNormalizedDocument(
            searchQuery,
            detectValueType(searchQuery),
            normalizedDoc,
            documentText
          )
          
          // 2. Fuzzy matches
          const fuzzyMatches = findFuzzyMatches(searchQuery, documentText, {
            minScore: 0.5,
            maxResults: 5,
            algorithm: 'hybrid'
          })
          
          // 3. Semantic matches
          const semanticResults = intelligentSearch(searchQuery, documentText, {
            maxResults: 5,
            minScore: 0.3
          })
          
          // Combine all results
          const combinedResults = []
          
          // Add exact matches
          exactMatches.forEach((match, index) => {
            combinedResults.push({
              id: `exact-${Date.now()}-${index}`,
              label: `Exact match - ${detectValueType(match.text)}`,
              value: match.text,
              matches: [{
                start: match.start,
                end: match.end,
                text: match.text,
                score: 1.0,
                confidence: 1.0,
                type: 'exact',
                id: `exact-match-${index}`,
                resultId: `exact-${Date.now()}-${index}`
              }]
            })
          })
          
          // Add fuzzy matches
          fuzzyMatches.forEach((match, index) => {
            combinedResults.push({
              id: `fuzzy-${Date.now()}-${index}`,
              label: `Fuzzy match (${(match.score * 100).toFixed(1)}%)`,
              value: match.text,
              matches: [{
                start: match.start,
                end: match.end,
                text: match.text,
                score: match.score,
                confidence: match.score,
                type: 'fuzzy',
                id: `fuzzy-match-${index}`,
                resultId: `fuzzy-${Date.now()}-${index}`
              }]
            })
          })
          
          // Add semantic matches
          semanticResults.forEach((result, index) => {
            if (result.matches && result.matches.length > 0) {
              combinedResults.push({
                id: `semantic-${Date.now()}-${index}`,
                label: `Semantic match (${result.primaryIntent})`,
                value: result.matches[0].term,
                matches: result.matches.map((match, mIndex) => ({
                  start: match.start || 0,
                  end: match.end || 0,
                  text: match.term,
                  score: match.score,
                  confidence: match.score,
                  type: 'semantic',
                  id: `semantic-match-${index}-${mIndex}`,
                  resultId: `semantic-${Date.now()}-${index}`
                }))
              })
            }
          })
          
          // Rank results intelligently
          results = rankSearchResults(combinedResults, searchQuery, documentText, {
            maxResults: 10,
            diversityBonus: true,
            groupSimilar: true,
            minScore: 0.1
          })
          
          break
        }
      }
      
      applySearchResults(results)
      
    } catch (error) {
      console.error('Search error:', error)
      applySearchResults([{
        id: Date.now(),
        value: `Search error: ${error.message}`,
        error: true,
        matches: []
      }])
    } finally {
      const metric = performanceMonitor.endTimer(timerId)
      if (metric) {
        setPerformanceStats({
          duration: metric.duration,
          operation: metric.operation,
          context: metric.context
        })
      }
    }
  }
  
  // Legacy test function for backwards compatibility
  const testLocalHighlight = () => {
    setSearchMode('intelligent')
    performIntelligentSearch()
  }

  const handleSearch = async () => {
    if (!searchQuery.trim() || !documentText.trim()) return
    
    // Check cache first
    const cacheKey = createQueryHash(searchQuery, documentText)
    const cachedResults = searchCache.get(`search-${cacheKey}`)
    
    if (cachedResults) {
      console.log('[Cache] Using cached results for query:', searchQuery)
      applySearchResults(cachedResults)
      return
    }
    
    // Use intelligent search for local queries
    if (searchQuery.includes('local:') || searchQuery.includes('test:')) {
      performIntelligentSearch()
      return
    }

    setIsSearching(true)
    const startTime = Date.now()

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
            // Enhance Claude results with intelligent ranking
            const rankedResults = rankSearchResults(
              claudeResponse.results, 
              searchQuery, 
              documentText, 
              { maxResults: 10, diversityBonus: true }
            )
            
            applySearchResults(rankedResults)
            logSearch(searchQuery, rankedResults, Date.now() - startTime)
            
            // Cache successful results
            searchCache.set(`search-${cacheKey}`, rankedResults)
          } else {
            // Fallback na původní formát
            const results = [{
              id: Date.now(),
              label: claudeResponse.label || null,
              value: claudeResponse.result || data.content[0].text,
              highlight: claudeResponse.highlight || []
            }]
            applySearchResults(results)
            logSearch(searchQuery, results, Date.now() - startTime)
            
            // Cache fallback results too
            searchCache.set(`search-${cacheKey}`, results)
          }
        } catch (parseError) {
          // Pokud není JSON, zkusíme rozdělit odpověď na jednotlivé položky
          const responseText = data.content[0].text
          let parsedResults = parseSimpleResponse(responseText, documentText)
          
          if (parsedResults.length > 0) {
            // Apply intelligent ranking even to parsed results
            parsedResults = rankSearchResults(
              parsedResults, 
              searchQuery, 
              documentText, 
              { maxResults: 5, minScore: 0.2 }
            )
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
      logError(error, { operation: 'search', query: searchQuery })
      
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
      
      // Pro demonstraci - pokud je API nedostupné, použijeme inteligentní vyhledávání
      if (documentText.length > 50) {
        console.log('[Fallback] API unavailable, using intelligent search')
        await performIntelligentSearch()
        return
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
    console.log('[Debug] Result clicked:', result)
    
    if (!result) {
      return
    }

    if (!result.matches || result.matches.length === 0) {
      console.log('[Debug] No matches found for result')
      setActiveResultId(null)
      setHighlightRanges([])
      return
    }

    const firstMatch = result.matches[0]
    if (!firstMatch) {
      return
    }

    console.log('[Debug] Setting active result:', result.id, 'matches:', result.matches)
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

  // Enhanced intelligent highlighting function with contract specialization
  const highlightDocument = (text, ranges) => {
    console.log('[Smart Highlight] Input:', { text: text?.length, ranges: ranges?.length, mode: searchMode })
    
    if (!text || !ranges || ranges.length === 0) {
      return escapeHtml(text || '')
    }

    // Merge overlapping ranges for better display
    const mergedRanges = mergeHighlightRanges(ranges, {
      mergeAdjacent: true,
      adjacentThreshold: 3,
      prioritizeType: 'score'
    })
    
    // Use contract-specific highlighting for contract mode
    if (searchMode === 'contract') {
      const contractOptions = {
        preserveFormatting: true,
        addDataAttributes: true,
        showConfidence: true,
        showLabels: true,
        groupByType: true,
        activeRangeId: activeResultId,
        accessible: true
      }
      
      const result = highlightLegalDocument(text, mergedRanges, contractOptions)
      console.log('[Contract Highlight] Generated legal document highlights with', mergedRanges.length, 'ranges')
      return result
    }
    
    // Use smart highlighting with advanced features for other modes
    const highlightOptions = {
      preserveFormatting: true,
      addDataAttributes: true,
      contextualStyling: true,
      activeRangeId: activeResultId,
      accessible: true
    }
    
    const result = smartHighlight(text, mergedRanges, highlightOptions)
    
    console.log('[Smart Highlight] Generated highlights with', mergedRanges.length, 'ranges')
    return result
  }

  console.log('[Render] isAuthorized:', isAuthorized)
  
  if (!isAuthorized) {
    console.log('[Render] Showing login page')
    return (
      <div className="auth-container">
        <div className="auth-panel">
          <h1 className="auth-title">Legal Document Analyzer</h1>
          <p className="auth-subtitle">Professional Contract Analysis Platform</p>
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
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleAuthorize(e)
                }
              }}
              autoFocus
              required
              autoComplete="current-password"
            />
            {authError && <div className="auth-error">{authError}</div>}
            <button type="submit" className="auth-button" disabled={isAuthenticating}>
              {isAuthenticating ? 'Přihlašování...' : 'Vstoupit'}
            </button>
          </form>
          <span className="auth-powered">Powered by Claude</span>
        </div>
        <button className="theme-toggle" onClick={toggleTheme} title="Toggle Theme">
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </div>
    )
  }

  console.log('[Render] Showing main app interface')
  return (
    <div className="app-container">
      <div className="search-panel">
        <div className="search-header">
          <div className="porsche-badge">
            <div className="badge-text">Legal Document Analyzer</div>
            <div className="badge-subtitle">Contract Analysis • Powered by Claude AI</div>
          </div>
        </div>
        
        <div className="search-input-container">
          <input
            type="text"
            className="search-input"
            placeholder="Vyhledávat v smlouvě: osobní údaje, částky, termíny, strany..."
            value={searchQuery}
            onChange={(e) => {
              const newQuery = e.target.value
              setSearchQuery(newQuery)
              
              // Real-time search with debouncing for local queries
              if (newQuery.startsWith('local:') && documentText) {
                globalDebouncer.debounce('realtime-search', () => {
                  performIntelligentSearch()
                }, 500)
              }
            }}
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
          <select
            className="search-mode-select"
            value={searchMode}
            onChange={(e) => setSearchMode(e.target.value)}
            style={{ marginLeft: '8px', padding: '0.5rem', fontSize: '0.8rem' }}
          >
            <option value="contract">🏛️ Smlouvy</option>
            <option value="intelligent">🧠 Inteligentní</option>
            <option value="fuzzy">🔍 Fuzzy</option>
            <option value="semantic">💡 Sémantické</option>
            <option value="simple">📄 Jednoduché</option>
          </select>
          <button 
            className="test-button"
            onClick={performIntelligentSearch}
            disabled={!searchQuery.trim() || !documentText.trim()}
            style={{ marginLeft: '8px', padding: '0.5rem', fontSize: '0.8rem' }}
          >
            Vyhledat
          </button>
          {highlightRanges.length > 0 && (
            <button 
              className="clear-button"
              onClick={() => {
                setHighlightRanges([])
                setActiveResultId(null)
                setSearchResults([])
              }}
              style={{ marginLeft: '8px', padding: '0.5rem', fontSize: '0.8rem', background: '#ff6b6b' }}
            >
              Clear
            </button>
          )}
          <button 
            className="filters-toggle"
            onClick={() => setShowFilters(!showFilters)}
            style={{ marginLeft: '8px', padding: '0.5rem', fontSize: '0.8rem' }}
          >
            {showFilters ? 'Hide' : 'Show'} Filters
          </button>
        </div>
        
        {/* Advanced Search Filters */}
        {renderSearchFilters()}
        
        {/* Performance stats */}
        {performanceStats && (
          <div className="performance-stats" style={{ margin: '0.5rem 0', fontSize: '0.75rem', color: '#666' }}>
            Vyhledávání dokončeno za {performanceStats.duration.toFixed(0)}ms
          </div>
        )}
        
        {/* Quick test examples */}
        <div className="quick-tests" style={{ margin: '1rem 0', fontSize: '0.75rem' }}>
          <div style={{ marginBottom: '0.5rem', color: '#888' }}>Rychlé testy (použijte prefix 'local:'):</div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button 
              onClick={() => {
                const testText = 'Jan Novák, rodné číslo: 940919/1022, kupní cena: 7 850 000 Kč'
                setDocumentText(testText)
                setSearchQuery('local:rodné číslo')
                setSearchMode('intelligent')
              }}
              style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem', background: '#4a9eff', color: 'white', border: 'none', borderRadius: '3px' }}
            >
              RNČ test
            </button>
            <button 
              onClick={() => {
                const testText = 'Jan Novák, rodné číslo: 940919/1022, kupní cena: 7 850 000 Kč'
                setDocumentText(testText)
                setSearchQuery('local:cena')
                setSearchMode('semantic')
              }}
              style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem', background: '#4a9eff', color: 'white', border: 'none', borderRadius: '3px' }}
            >
              Částka test
            </button>
            <button 
              onClick={() => {
                const testText = 'Jan Novák, rodné číslo: 940919/1022, kupní cena: 7 850 000 Kč'
                setDocumentText(testText)
                setSearchQuery('local:Jan')
                setSearchMode('fuzzy')
              }}
              style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem', background: '#4a9eff', color: 'white', border: 'none', borderRadius: '3px' }}
            >
              Jméno test
            </button>
            <button 
              onClick={() => {
                setDocumentText('Tomáš Novotný - 680412/2156, Petra Novotná - 705523/3298, Martin Procházka - 850915/4789')
                setSearchQuery('local:osoba')
                setSearchMode('intelligent')
                performIntelligentSearch()
              }}
              style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem', background: '#ff6b6b', color: 'white', border: 'none', borderRadius: '3px' }}
            >
              Multi-person test
            </button>
          </div>
        </div>
        
        {searchWarnings.length > 0 && (
          <div className="warnings-section">
            <div className="warnings-header">
              <h3 className="warnings-title">Varování</h3>
            </div>
            <div className="warnings-container">
              {searchWarnings.map((warning, index) => (
                <div key={index} className="warning-item">
                  {warning}
                </div>
              ))}
            </div>
          </div>
        )}

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
                    <div className="result-label">
                      {result.label}
                      {result.type && (
                        <span className={`status-indicator ${result.type}`} style={{marginLeft: '0.5rem', padding: '0.25rem 0.5rem'}}>
                          {result.type}
                        </span>
                      )}
                    </div>
                  )}
                  <div className={result.label ? 'result-value' : 'result-content'}>
                    {result.value ?? result.content}
                  </div>
                  {result.confidence && (
                    <div style={{marginTop: '0.75rem'}}>
                      {renderConfidenceMeter(result.confidence, 'Přesnost')}
                    </div>
                  )}
                  {result.context && (
                    <div style={{marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--legal-text-muted)', fontStyle: 'italic'}}>
                      Kontext: {result.context}
                    </div>
                  )}
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
          <h2 className="content-title">Smlouva / Právní dokument</h2>
          <div className="content-stats">
            {highlightRanges.length > 0 && (
              <>
                <span style={{ fontSize: '0.8rem', color: '#4a9eff', marginRight: '1rem' }}>
                  {highlightRanges.length} zvýraznění
                </span>
                <button 
                  className="edit-button"
                  onClick={() => {
                    setHighlightRanges([])
                    setActiveResultId(null)
                    setSearchResults([])
                  }}
                >
                  Upravit text
                </button>
              </>
            )}
            {highlightRanges.length === 0 && documentText && (
              <span style={{ fontSize: '0.8rem', color: '#888' }}>
                {documentText.length} znaků
              </span>
            )}
          </div>
        </div>

        <div className="document-input-container">
          <textarea
            className="document-input"
            placeholder="Vložte text smlouvy nebo právního dokumentu pro analýzu a vyhledávání klíčových informací..."
            value={documentText}
            onChange={(e) => setDocumentText(e.target.value)}
            style={{ display: highlightRanges.length > 0 ? 'none' : 'block' }}
          />
          {highlightRanges.length === 0 && (isDocumentPreparing || showNormalizationOverlay) && (
            <div className="document-overlay">Připravuji dokument…</div>
          )}
          {highlightRanges.length > 0 && (
            <div 
              className="document-highlighted"
              ref={highlightedDocumentRef}
              dangerouslySetInnerHTML={{
                __html: (() => {
                  console.log('[Component] Rendering highlighted document with ranges:', highlightRanges)
                  const html = highlightDocument(documentText, highlightRanges)
                  console.log('[Component] Generated HTML preview:', html.substring(0, 300))
                  return html
                })()
              }}
            />
          )}
        </div>
      </div>

      {/* Theme Toggle Button */}
      <button className="theme-toggle" onClick={toggleTheme} title="Toggle Theme">
        {theme === 'dark' ? '☀️' : '🌙'}
      </button>

      {/* Performance Analytics */}
      {performanceStats && (
        <div className="data-viz-container" style={{position: 'fixed', bottom: '2rem', right: '5rem', width: '300px', zIndex: '999'}}>
          <div className="data-viz-header">
            <h3 className="data-viz-title">Performance</h3>
          </div>
          <div style={{display: 'flex', flexDirection: 'column', gap: '0.5rem'}}>
            {renderConfidenceMeter(Math.min(performanceStats.duration / 1000, 1), 'Speed')}
            <div style={{fontSize: '0.75rem', color: 'var(--legal-text-muted)'}}>
              Search completed in {performanceStats.duration.toFixed(0)}ms
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App

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
  console.log('[Simple Render] Text length:', text.length, 'Ranges:', ranges.length)
  
  if (!ranges || ranges.length === 0 || !text) {
    return escapeHtml(text)
  }

  // Jednoduchý přístup - zpracuj jeden po druhém
  let result = escapeHtml(text)
  
  // Seřaď ranges od konce aby se neposunuly indexy
  const sortedRanges = [...ranges]
    .filter(r => r && typeof r.start === 'number' && typeof r.end === 'number' && r.start < r.end)
    .sort((a, b) => b.start - a.start)
    
  console.log('[Simple Render] Valid ranges:', sortedRanges)
  
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
      
      console.log(`[Simple Render] Applied highlight ${i}:`, {
        start, end, 
        text: text.substring(start, end),
        hasMarkTag: result.includes('<mark')
      })
    }
  })
  
  console.log('[Simple Render] Final result has highlights:', result.includes('<mark'))
  console.log('[Simple Render] Preview:', result.substring(0, 300))
  
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
  const [normalizedDocument, setNormalizedDocument] = useState(null)
  const [showNormalizationOverlay, setShowNormalizationOverlay] = useState(false)

  const documentSearcher = useMemo(() => createDocumentSearcher(documentText), [documentText])

  const [isAuthorized, setIsAuthorized] = useState(() => {
    if (typeof window === 'undefined') {
      return false
    }
    return window.localStorage.getItem('aiSearchAuth') === 'true'
  })
  const [passwordInput, setPasswordInput] = useState('')
  const [authError, setAuthError] = useState('')
  const [searchWarnings, setSearchWarnings] = useState([])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const savedAuth = window.localStorage.getItem('aiSearchAuth') === 'true'
    if (savedAuth) {
      setIsAuthorized(true)
    }
  }, [])

  // Debounced document normalization
  const normalizeDocument = useCallback(
    createDebouncedNormalizer((normalized) => {
      setNormalizedDocument(normalized)
      setShowNormalizationOverlay(false)
      logNormalization(
        documentText.length,
        normalized.normalized.length,
        300
      )
    }, 300),
    []
  )

  useEffect(() => {
    if (!documentText) {
      setIsDocumentPreparing(false)
      setNormalizedDocument(null)
      setShowNormalizationOverlay(false)
      return
    }

    setIsDocumentPreparing(true)
    setShowNormalizationOverlay(true)
    
    // Normalize document after debounce
    normalizeDocument(documentText)
    
    const timer = setTimeout(() => {
      setIsDocumentPreparing(false)
    }, 250)

    return () => clearTimeout(timer)
  }, [documentText, normalizeDocument])

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
          
          // Log successful validation
          if (extractedText !== value) {
            logMismatch(value, extractedText, {
              reason: 'AI indices adjusted',
              type: valueType,
              indices: { start, end }
            })
          }
        } else {
          logValidation(extractedText, valueType, false, {
            expected: value,
            indices: { start, end },
            reason: 'Invalid AI indices'
          })
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
          logger.warn('Search', 'Value not found in document', { 
            value, 
            label,
            type: detectValueType(value)
          })
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
          console.log(`[Extract] Found ${matches.length} individual values for:`, value)
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
    console.log('[Debug] Prepared results:', preparedResults)
    console.log('[Debug] Combined matches:', combinedMatches)
    console.log('[Debug] Setting highlight ranges count:', combinedMatches.length)
    
    // Ensure all matches have valid indices
    const validMatches = combinedMatches.filter(match => {
      const isValid = match && typeof match.start === 'number' && typeof match.end === 'number' && match.end > match.start
      if (!isValid) {
        console.warn('[Debug] Invalid match found:', match)
      }
      return isValid
    })
    
    console.log('[Debug] Valid matches:', validMatches)
    console.log('[Debug] About to set highlightRanges...')
    setHighlightRanges(validMatches)
    
    // Check if state was actually updated
    setTimeout(() => {
      console.log('[Debug] HighlightRanges state after update:', highlightRanges.length)
    }, 100)
    
    setActiveResultId(null)
    setSearchWarnings(warnings)
  }

  useEffect(() => {
    const savedHistory = localStorage.getItem('searchHistory')
    if (savedHistory) {
      setSearchHistory(JSON.parse(savedHistory))
    }
  }, [])

  // Enhanced test function for local highlighting
  const testLocalHighlight = () => {
    if (!searchQuery.trim() || !documentText.trim()) return
    
    console.log('[Test] Starting local highlight test')
    console.log('[Test] Query:', searchQuery)
    console.log('[Test] Document length:', documentText.length)
    
    // Use our new findValueInNormalizedDocument function
    const matches = findValueInNormalizedDocument(
      searchQuery,
      detectValueType(searchQuery),
      normalizedDocument || createNormalizedDocument(documentText),
      documentText
    )
    
    console.log('[Test] Found matches:', matches)
    
    if (matches.length > 0) {
      const testResults = matches.map((match, index) => ({
        id: `test-result-${Date.now()}-${index}`,
        label: `${detectValueType(searchQuery)} - Test výsledek`,
        value: match.text,
        matches: [{
          start: match.start,
          end: match.end,
          text: match.text,
          id: `test-match-${Date.now()}-${index}`,
          resultId: `test-result-${Date.now()}-${index}`
        }]
      }))
      
      console.log('[Test] Creating test results:', testResults)
      applySearchResults(testResults)
    } else {
      // Fallback to simple text search
      const query = searchQuery.toLowerCase()
      const text = documentText.toLowerCase()
      const index = text.indexOf(query)
      
      if (index !== -1) {
        // Find original case text
        const originalText = documentText.substring(index, index + searchQuery.length)
        
        const testResults = [{
          id: Date.now(),
          label: 'Simple text match',
          value: originalText,
          matches: [{
            start: index,
            end: index + searchQuery.length,
            text: originalText,
            id: `fallback-match-${Date.now()}`,
            resultId: Date.now()
          }]
        }]
        
        console.log('[Test] Using fallback text search:', testResults)
        applySearchResults(testResults)
      } else {
        console.log('[Test] Query not found in document')
        applySearchResults([])
      }
    }
  }

  const handleSearch = async () => {
    if (!searchQuery.trim() || !documentText.trim()) return
    
    // For testing - use local highlight first
    if (searchQuery.includes('test:')) {
      testLocalHighlight()
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
            applySearchResults(claudeResponse.results)
            logSearch(searchQuery, claudeResponse.results, Date.now() - startTime)
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

  // ZJEDNODUŠENÁ FUNKCE
  const highlightDocument = (text, ranges) => {
    console.log('[Simple Highlight] Input:', { text: text?.length, ranges: ranges?.length })
    
    if (!text || !ranges || ranges.length === 0) {
      return escapeHtml(text || '')
    }
    
    // Přímo volañ zjednodušené renderování
    return renderHighlightedDocument(text, ranges)
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
          <button 
            className="test-button"
            onClick={testLocalHighlight}
            disabled={!searchQuery.trim() || !documentText.trim()}
            style={{ marginLeft: '8px', padding: '0.5rem', fontSize: '0.8rem' }}
          >
            Test
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
        </div>
        
        {/* Quick test examples */}
        <div className="quick-tests" style={{ margin: '1rem 0', fontSize: '0.75rem' }}>
          <div style={{ marginBottom: '0.5rem', color: '#888' }}>Rychlé testy:</div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button 
              onClick={() => {
                const testText = 'Jan Novák, rodné číslo: 940919/1022, kupní cena: 7 850 000 Kč'
                setDocumentText(testText)
                
                // Přímo nastav highlighty
                const testHighlights = [{
                  start: testText.indexOf('940919/1022'),
                  end: testText.indexOf('940919/1022') + '940919/1022'.length,
                  id: 'test-rn',
                  text: '940919/1022'
                }]
                
                console.log('[Test] Setting direct highlights:', testHighlights)
                setHighlightRanges(testHighlights)
                setSearchResults([{ id: 1, label: 'RNČ', value: '940919/1022', matches: testHighlights }])
              }}
              style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem', background: '#4a9eff', color: 'white', border: 'none', borderRadius: '3px' }}
            >
              RNČ test
            </button>
            <button 
              onClick={() => {
                const testText = 'Jan Novák, rodné číslo: 940919/1022, kupní cena: 7 850 000 Kč'
                setDocumentText(testText)
                
                const testHighlights = [{
                  start: testText.indexOf('7 850 000'),
                  end: testText.indexOf('7 850 000') + '7 850 000'.length,
                  id: 'test-amount',
                  text: '7 850 000'
                }]
                
                console.log('[Test] Setting amount highlights:', testHighlights)
                setHighlightRanges(testHighlights)
                setSearchResults([{ id: 2, label: 'Částka', value: '7 850 000', matches: testHighlights }])
              }}
              style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem', background: '#4a9eff', color: 'white', border: 'none', borderRadius: '3px' }}
            >
              Částka test
            </button>
            <button 
              onClick={() => {
                const testText = 'Jan Novák, rodné číslo: 940919/1022, kupní cena: 7 850 000 Kč'
                setDocumentText(testText)
                
                const testHighlights = [{
                  start: testText.indexOf('Jan Novák'),
                  end: testText.indexOf('Jan Novák') + 'Jan Novák'.length,
                  id: 'test-name',
                  text: 'Jan Novák'
                }]
                
                console.log('[Test] Setting name highlights:', testHighlights)
                setHighlightRanges(testHighlights)
                setSearchResults([{ id: 3, label: 'Jméno', value: 'Jan Novák', matches: testHighlights }])
              }}
              style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem', background: '#4a9eff', color: 'white', border: 'none', borderRadius: '3px' }}
            >
              Jméno test
            </button>
            <button 
              onClick={() => {
                setDocumentText('Tomáš Novotný - 680412/2156, Petra Novotná - 705523/3298, Martin Procházka - 850915/4789')
                // Simulace Claude odpovědi
                const mockResults = [{
                  id: 1,
                  label: 'Výsledek 1',
                  value: 'Tomáš Novotný - 680412/2156'
                }, {
                  id: 2, 
                  label: 'Výsledek 2',
                  value: 'Petra Novotná - 705523/3298'
                }, {
                  id: 3,
                  label: 'Výsledek 3', 
                  value: 'Martin Procházka - 850915/4789'
                }]
                applySearchResults(mockResults)
              }}
              style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem', background: '#ff6b6b', color: 'white', border: 'none', borderRadius: '3px' }}
            >
              Simulate Claude
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
            placeholder="Vložte nebo napište text dokumentu, ve kterém chcete vyhledávat..."
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
    </div>
  )
}

export default App

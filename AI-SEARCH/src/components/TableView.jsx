import { useState, useMemo } from 'react'
import './TableView.css'

const TableView = ({
  searchResults = [],
  onExport,
  onResultClick,
  selectedFields = ['category', 'query', 'label', 'value', 'absoluteValue', 'type'],
  showExportOptions = true
}) => {
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' })
  const [selectedRows, setSelectedRows] = useState(new Set())
  const [filterText, setFilterText] = useState('')

  // Available columns for export
  const availableColumns = [
    { key: 'category', label: 'Kategorie', type: 'text' },
    { key: 'query', label: 'Dotaz', type: 'text' },
    { key: 'label', label: 'Popisek', type: 'text' },
    { key: 'value', label: 'Hodnota', type: 'text' },
    { key: 'absoluteValue', label: 'Absolutní hodnota', type: 'text' },
    { key: 'type', label: 'Typ', type: 'text' }
  ]

  // Detect if value is number or text
  const detectValueType = (value) => {
    if (!value) return 'text'
    const str = String(value).trim()

    // Check if it's primarily numeric (digits, spaces, common separators, currency)
    // Birth number: 940819/1011
    // Amount: 7.850.000,- Kč
    // Phone: +420 123 456 789
    const numericPattern = /^[\d\s.,+\-/]+\s*[A-Za-zčČ]*\.?-?$/

    return numericPattern.test(str) ? 'number' : 'text'
  }

  // Extract absolute numeric value (remove all non-digits)
  const extractAbsoluteValue = (value, valueType) => {
    if (!value || valueType === 'text') return ''

    const str = String(value)
    // Remove everything except digits
    const digitsOnly = str.replace(/\D/g, '')

    return digitsOnly || ''
  }

  // Transform search results for table display
  const tableData = useMemo(() => {
    const rows = []

    searchResults.forEach((result, index) => {
      if (result.answer) {
        // AI response format
        if (result.answer.type === 'single') {
          // Single result - one row
          const value = result.answer.value
          const valueType = detectValueType(value)
          const absoluteValue = extractAbsoluteValue(value, valueType)

          rows.push({
            id: `${index}-0`,
            category: result.category || '',
            query: result.query || 'Dotaz',
            label: result.answer.label || 'Výsledek',
            value: value,
            type: valueType,
            absoluteValue: absoluteValue,
            rawResult: result
          })
        } else if (result.answer.type === 'multiple' && result.answer.results?.length > 0) {
          // Multiple results - separate row for each
          result.answer.results.forEach((item, itemIndex) => {
            const value = item.value
            const valueType = detectValueType(value)
            const absoluteValue = extractAbsoluteValue(value, valueType)

            rows.push({
              id: `${index}-${itemIndex}`,
              category: result.category || '',
              query: result.query || 'Dotaz',
              label: item.label || 'Výsledek',
              value: value,
              type: valueType,
              absoluteValue: absoluteValue,
              rawResult: result
            })
          })
        }
      } else {
        // Fallback for non-AI results
        const value = typeof result.value === 'string' ? result.value : (result.content || '')
        const valueType = detectValueType(value)
        const absoluteValue = extractAbsoluteValue(value, valueType)

        rows.push({
          id: result.id || index,
          category: result.category || '',
          query: result.query || 'Dotaz',
          label: result.label || 'Výsledek',
          value: value,
          type: valueType,
          absoluteValue: absoluteValue,
          rawResult: result
        })
      }
    })

    return rows
  }, [searchResults])

  // Filter data based on search text
  const filteredData = useMemo(() => {
    if (!filterText) return tableData
    
    const searchTerm = filterText.toLowerCase()
    return tableData.filter(row => 
      Object.values(row).some(value => 
        String(value).toLowerCase().includes(searchTerm)
      )
    )
  }, [tableData, filterText])

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortConfig.key) return filteredData
    
    return [...filteredData].sort((a, b) => {
      const aVal = a[sortConfig.key]
      const bVal = b[sortConfig.key]
      
      if (aVal === bVal) return 0
      
      let comparison = 0
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        comparison = aVal - bVal
      } else {
        comparison = String(aVal).localeCompare(String(bVal))
      }
      
      return sortConfig.direction === 'desc' ? -comparison : comparison
    })
  }, [filteredData, sortConfig])

  const handleSort = (key) => {
    setSortConfig(prevConfig => ({
      key,
      direction: prevConfig.key === key && prevConfig.direction === 'asc' ? 'desc' : 'asc'
    }))
  }

  const handleRowSelect = (id) => {
    setSelectedRows(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  const handleSelectAll = () => {
    if (selectedRows.size === sortedData.length) {
      setSelectedRows(new Set())
    } else {
      setSelectedRows(new Set(sortedData.map(row => row.id)))
    }
  }

  const formatCellValue = (value, type) => {
    if (value === null || value === undefined) return ''
    
    switch (type) {
      case 'number':
        if (typeof value === 'number') {
          return value.toFixed(3)
        }
        return value
      case 'datetime':
        return new Date(value).toLocaleString('cs-CZ')
      default:
        return String(value)
    }
  }

  const getSortIcon = (columnKey) => {
    if (sortConfig.key !== columnKey) {
      return '↕️'
    }
    return sortConfig.direction === 'asc' ? '↑' : '↓'
  }

  const getSelectedRowsData = () => {
    const selected = sortedData.filter(row => selectedRows.has(row.id))
    // If nothing is selected, export all data
    return selected.length > 0 ? selected : sortedData
  }

  return (
    <div className="table-view">
      <div className="table-controls">
        <div className="table-filters">
          <input
            type="text"
            placeholder="Filtrovat výsledky..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="filter-input"
          />
          <span className="result-count">
            {selectedRows.size > 0 ? `${selectedRows.size}/${sortedData.length}` : sortedData.length} výsledků
          </span>
        </div>
        
        {showExportOptions && (
          <div className="export-buttons">
            <button
              onClick={() => onExport?.('csv', getSelectedRowsData())}
              disabled={sortedData.length === 0}
              className="export-button"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              CSV
            </button>
            <button
              onClick={() => onExport?.('xlsx', getSelectedRowsData())}
              disabled={sortedData.length === 0}
              className="export-button"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M3 3v18h18V3H3zm16 16H5V5h14v14z" fill="currentColor"/>
                <path d="M7 7h4v4H7zM13 7h4v4h-4zM7 13h4v4H7zM13 13h4v4h-4z" fill="currentColor"/>
              </svg>
              Excel
            </button>
            <button
              onClick={() => onExport?.('pdf', getSelectedRowsData())}
              disabled={sortedData.length === 0}
              className="export-button"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M14 2v6h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M9 15h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              PDF
            </button>
          </div>
        )}
      </div>

      <div className="table-container">
        <table className="results-table">
          <thead>
            <tr>
              <th className="select-column">
                <input
                  type="checkbox"
                  checked={selectedRows.size === sortedData.length && sortedData.length > 0}
                  onChange={handleSelectAll}
                />
              </th>
              {availableColumns
                .filter(col => selectedFields.includes(col.key))
                .map(column => (
                  <th
                    key={column.key}
                    className={`sortable ${sortConfig.key === column.key ? 'sorted' : ''}`}
                    onClick={() => handleSort(column.key)}
                  >
                    {column.label}
                    <span className="sort-indicator">
                      {getSortIcon(column.key)}
                    </span>
                  </th>
                ))}
              <th>Akce</th>
            </tr>
          </thead>
          <tbody>
            {sortedData.map((row, index) => (
              <tr
                key={row.id}
                className={`table-row ${selectedRows.has(row.id) ? 'selected' : ''}`}
              >
                <td className="select-column">
                  <input
                    type="checkbox"
                    checked={selectedRows.has(row.id)}
                    onChange={() => handleRowSelect(row.id)}
                  />
                </td>
                {availableColumns
                  .filter(col => selectedFields.includes(col.key))
                  .map(column => (
                    <td key={column.key} className={`cell-${column.type}`}>
                      {column.key === 'value' ? (
                        <span
                          className="value-cell clickable"
                          onClick={() => onResultClick?.(row.rawResult)}
                          title="Klikněte pro zvýraznění v dokumentu"
                        >
                          {formatCellValue(row[column.key], column.type)}
                        </span>
                      ) : (
                        formatCellValue(row[column.key], column.type)
                      )}
                    </td>
                  ))}
                <td className="actions-column">
                  <button
                    onClick={() => onResultClick?.(row.rawResult)}
                    className="action-button"
                    title="Zvýraznit v dokumentu"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
                      <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  </button>
                  <button
                    onClick={() => navigator.clipboard.writeText(row.value)}
                    className="action-button"
                    title="Kopírovat hodnotu"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" stroke="currentColor" strokeWidth="2"/>
                      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke="currentColor" strokeWidth="2"/>
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {sortedData.length === 0 && (
          <div className="empty-table">
            <p>Žádné výsledky k zobrazení</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default TableView
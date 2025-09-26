import { useState, useMemo } from 'react'
import './TableView.css'

const TableView = ({ 
  searchResults = [], 
  onExport, 
  onResultClick,
  selectedFields = ['label', 'value', 'type', 'confidence', 'context'],
  showExportOptions = true 
}) => {
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' })
  const [selectedRows, setSelectedRows] = useState(new Set())
  const [filterText, setFilterText] = useState('')

  // Available columns for export
  const availableColumns = [
    { key: 'label', label: 'Popisek', type: 'text' },
    { key: 'value', label: 'Hodnota', type: 'text' },
    { key: 'type', label: 'Typ', type: 'text' },
    { key: 'confidence', label: 'Spolehlivost', type: 'number' },
    { key: 'context', label: 'Kontext', type: 'text' },
    { key: 'matchCount', label: 'Počet shod', type: 'number' },
    { key: 'startPosition', label: 'Pozice', type: 'number' },
    { key: 'extractedAt', label: 'Extrahováno', type: 'datetime' }
  ]

  // Transform search results for table display
  const tableData = useMemo(() => {
    return searchResults.map((result, index) => {
      const primaryMatch = result.matches?.[0]
      
      return {
        id: result.id || index,
        label: result.label || 'Výsledek',
        value: result.value || result.content || '',
        type: result.type || 'text',
        confidence: result.confidence || primaryMatch?.confidence || primaryMatch?.score || 0,
        context: result.context || '',
        matchCount: result.matches?.length || 0,
        startPosition: primaryMatch?.start || 0,
        extractedAt: new Date().toISOString(),
        rawResult: result
      }
    })
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
    return sortedData.filter(row => selectedRows.has(row.id))
  }

  const detectValueType = (value) => {
    if (!value) return 'text'
    
    const str = String(value)
    if (/^\d{6}\/\d{3,4}$/.test(str)) return 'birthNumber'
    if (/^\d+(?:[.,]\d+)?\s*(?:Kč|CZK|€|EUR)$/i.test(str)) return 'currency'
    if (/^(\+420\s?)?\d{3}\s?\d{3}\s?\d{3}$/.test(str)) return 'phone'
    if (/^\d+\/\d+$/.test(str)) return 'fraction'
    if (/^[A-Z][a-z]+\s+[A-Z][a-z]+$/.test(str)) return 'name'
    if (/^\d+$/.test(str)) return 'number'
    
    return 'text'
  }

  const extractContext = (value, fullText) => {
    if (!value || !fullText) return ''
    
    const index = fullText.indexOf(value)
    if (index === -1) return ''
    
    const start = Math.max(0, index - 50)
    const end = Math.min(fullText.length, index + value.length + 50)
    const context = fullText.slice(start, end)
    
    return context.replace(value, `**${value}**`)
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
              className="export-button csv"
            >
              📊 CSV
            </button>
            <button
              onClick={() => onExport?.('xlsx', getSelectedRowsData())}
              disabled={sortedData.length === 0}
              className="export-button xlsx"
            >
              📈 Excel
            </button>
            <button
              onClick={() => onExport?.('pdf', getSelectedRowsData())}
              disabled={sortedData.length === 0}
              className="export-button pdf"
            >
              📄 PDF
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
                    className="action-button highlight"
                    title="Zvýraznit v dokumentu"
                  >
                    🔍
                  </button>
                  <button
                    onClick={() => navigator.clipboard.writeText(row.value)}
                    className="action-button copy"
                    title="Kopírovat hodnotu"
                  >
                    📋
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
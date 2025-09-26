import { useState, useEffect } from 'react'
import './CustomFieldSelector.css'

const CustomFieldSelector = ({ 
  availableFields = [], 
  selectedFields = [], 
  onSelectionChange,
  exportFormat = 'xlsx',
  searchResults = [],
  onExport,
  isOpen = false,
  onClose
}) => {
  const [localSelectedFields, setLocalSelectedFields] = useState(selectedFields)
  const [fieldSearch, setFieldSearch] = useState('')
  const [fieldGroups, setFieldGroups] = useState({})
  const [previewData, setPreviewData] = useState([])
  const [exportOptions, setExportOptions] = useState({
    includeHeaders: true,
    includeMetadata: true,
    includeTimestamp: true,
    maxRows: 1000,
    dateFormat: 'ISO',
    numberFormat: 'decimal',
    textEncoding: 'UTF-8'
  })

  // Default field configurations
  const defaultFields = [
    { key: 'label', label: 'Popisek', type: 'text', group: 'basic', description: 'Textový popisek výsledku' },
    { key: 'value', label: 'Hodnota', type: 'text', group: 'basic', description: 'Extrahovaná hodnota' },
    { key: 'type', label: 'Typ dat', type: 'text', group: 'basic', description: 'Detekovaný typ hodnoty' },
    { key: 'confidence', label: 'Spolehlivost', type: 'number', group: 'quality', description: 'Míra spolehlivosti extrakce (0-1)' },
    { key: 'context', label: 'Kontext', type: 'text', group: 'content', description: 'Okolní text hodnoty' },
    { key: 'startPosition', label: 'Pozice začátku', type: 'number', group: 'position', description: 'Pozice začátku v dokumentu' },
    { key: 'endPosition', label: 'Pozice konce', type: 'number', group: 'position', description: 'Pozice konce v dokumentu' },
    { key: 'matchCount', label: 'Počet shod', type: 'number', group: 'quality', description: 'Počet nalezených shod' },
    { key: 'extractedAt', label: 'Čas extrakce', type: 'datetime', group: 'metadata', description: 'Čas kdy byla hodnota extrahována' },
    { key: 'searchQuery', label: 'Vyhledávací dotaz', type: 'text', group: 'metadata', description: 'Použitý vyhledávací dotaz' },
    { key: 'searchMode', label: 'Režim vyhledávání', type: 'text', group: 'metadata', description: 'Použitý režim vyhledávání' },
    { key: 'documentLength', label: 'Délka dokumentu', type: 'number', group: 'metadata', description: 'Celková délka zdrojového dokumentu' },
    { key: 'resultIndex', label: 'Index výsledku', type: 'number', group: 'metadata', description: 'Pořadové číslo výsledku' },
    { key: 'isValidated', label: 'Ověřeno', type: 'boolean', group: 'quality', description: 'Zda byla hodnota ověřena' },
    { key: 'validationStatus', label: 'Status ověření', type: 'text', group: 'quality', description: 'Status validace hodnoty' },
    { key: 'dataCategory', label: 'Kategorie dat', type: 'text', group: 'classification', description: 'Kategorie extrahovaných dat' },
    { key: 'privacyLevel', label: 'Úroveň citlivosti', type: 'text', group: 'classification', description: 'Úroveň citlivosti dat' },
    { key: 'language', label: 'Jazyk', type: 'text', group: 'linguistic', description: 'Detekovaný jazyk hodnoty' },
    { key: 'wordCount', label: 'Počet slov', type: 'number', group: 'linguistic', description: 'Počet slov v hodnotě' },
    { key: 'characterCount', label: 'Počet znaků', type: 'number', group: 'linguistic', description: 'Počet znaků v hodnotě' }
  ]

  const fieldGroupLabels = {
    basic: 'Základní informace',
    quality: 'Kvalita a spolehlivost',
    content: 'Obsah a kontext',
    position: 'Pozice v dokumentu',
    metadata: 'Metadata',
    classification: 'Klasifikace',
    linguistic: 'Jazykové vlastnosti'
  }

  useEffect(() => {
    // Merge available fields with default configurations
    const mergedFields = defaultFields.map(defaultField => {
      const availableField = availableFields.find(af => af.key === defaultField.key)
      return availableField ? { ...defaultField, ...availableField } : defaultField
    })

    // Add any additional available fields
    availableFields.forEach(field => {
      if (!mergedFields.find(mf => mf.key === field.key)) {
        mergedFields.push({
          ...field,
          group: field.group || 'other',
          type: field.type || 'text',
          description: field.description || `Pole ${field.label || field.key}`
        })
      }
    })

    // Group fields
    const groups = {}
    mergedFields.forEach(field => {
      const group = field.group || 'other'
      if (!groups[group]) groups[group] = []
      groups[group].push(field)
    })

    setFieldGroups(groups)
  }, [availableFields])

  useEffect(() => {
    // Generate preview data when selection changes
    if (localSelectedFields.length > 0 && searchResults.length > 0) {
      const preview = searchResults.slice(0, 3).map(result => {
        const previewRow = {}
        localSelectedFields.forEach(fieldKey => {
          previewRow[fieldKey] = formatFieldValue(result, fieldKey)
        })
        return previewRow
      })
      setPreviewData(preview)
    } else {
      setPreviewData([])
    }
  }, [localSelectedFields, searchResults])

  const formatFieldValue = (result, fieldKey) => {
    switch (fieldKey) {
      case 'label':
        return result.label || 'Bez popisku'
      case 'value':
        return result.value || ''
      case 'type':
        return result.type || 'neznámý'
      case 'confidence':
        return typeof result.confidence === 'number' ? (result.confidence * 100).toFixed(1) + '%' : 'N/A'
      case 'context':
        return result.context || extractContext(result)
      case 'startPosition':
        return result.matches?.[0]?.start || result.start || 0
      case 'endPosition':
        return result.matches?.[0]?.end || result.end || 0
      case 'matchCount':
        return result.matches?.length || 0
      case 'extractedAt':
        return result.extractedAt || new Date().toISOString()
      case 'searchQuery':
        return result.batchQuery || result.searchQuery || ''
      case 'searchMode':
        return result.searchMode || 'intelligent'
      case 'documentLength':
        return result.documentLength || 0
      case 'resultIndex':
        return result.resultIndex || 0
      case 'isValidated':
        return result.isValidated ? 'Ano' : 'Ne'
      case 'validationStatus':
        return result.validationStatus || 'neověřeno'
      case 'dataCategory':
        return classifyDataCategory(result)
      case 'privacyLevel':
        return assessPrivacyLevel(result)
      case 'language':
        return detectLanguage(result.value)
      case 'wordCount':
        return result.value ? result.value.split(/\\s+/).length : 0
      case 'characterCount':
        return result.value ? result.value.length : 0
      default:
        return result[fieldKey] || ''
    }
  }

  const extractContext = (result) => {
    if (result.context) return result.context
    if (!result.value || !result.documentText) return ''
    
    const index = result.documentText.indexOf(result.value)
    if (index === -1) return ''
    
    const start = Math.max(0, index - 30)
    const end = Math.min(result.documentText.length, index + result.value.length + 30)
    return result.documentText.slice(start, end)
  }

  const classifyDataCategory = (result) => {
    const type = result.type || ''
    if (['birthNumber', 'name', 'phone', 'email'].includes(type)) return 'osobní údaje'
    if (['currency', 'amount', 'financial'].includes(type)) return 'finanční údaje'
    if (['date', 'datetime'].includes(type)) return 'časové údaje'
    if (['address', 'location'].includes(type)) return 'lokační údaje'
    return 'ostatní'
  }

  const assessPrivacyLevel = (result) => {
    const category = classifyDataCategory(result)
    switch (category) {
      case 'osobní údaje': return 'vysoká'
      case 'finanční údaje': return 'vysoká'
      case 'lokační údaje': return 'střední'
      default: return 'nízká'
    }
  }

  const detectLanguage = (value) => {
    if (!value) return 'neznámý'
    const hasCzechChars = /[áčďéěíňóřšťúůýž]/i.test(value)
    const hasOnlyAscii = /^[a-zA-Z0-9\\s.,!?-]+$/.test(value)
    
    if (hasCzechChars) return 'čeština'
    if (hasOnlyAscii && /[a-zA-Z]/.test(value)) return 'angličtina'
    return 'smíšený'
  }

  const handleFieldToggle = (fieldKey) => {
    const newSelection = localSelectedFields.includes(fieldKey)
      ? localSelectedFields.filter(key => key !== fieldKey)
      : [...localSelectedFields, fieldKey]
    
    setLocalSelectedFields(newSelection)
    onSelectionChange?.(newSelection)
  }

  const handleSelectAll = () => {
    const allFields = Object.values(fieldGroups).flat().map(field => field.key)
    setLocalSelectedFields(allFields)
    onSelectionChange?.(allFields)
  }

  const handleSelectNone = () => {
    setLocalSelectedFields([])
    onSelectionChange?.([])
  }

  const handleSelectGroup = (groupKey) => {
    const groupFields = fieldGroups[groupKey]?.map(field => field.key) || []
    const newSelection = [...new Set([...localSelectedFields, ...groupFields])]
    setLocalSelectedFields(newSelection)
    onSelectionChange?.(newSelection)
  }

  const handleDeselectGroup = (groupKey) => {
    const groupFields = fieldGroups[groupKey]?.map(field => field.key) || []
    const newSelection = localSelectedFields.filter(key => !groupFields.includes(key))
    setLocalSelectedFields(newSelection)
    onSelectionChange?.(newSelection)
  }

  const getFilteredGroups = () => {
    if (!fieldSearch) return fieldGroups
    
    const filtered = {}
    Object.entries(fieldGroups).forEach(([groupKey, fields]) => {
      const matchingFields = fields.filter(field => 
        field.label.toLowerCase().includes(fieldSearch.toLowerCase()) ||
        field.key.toLowerCase().includes(fieldSearch.toLowerCase()) ||
        (field.description && field.description.toLowerCase().includes(fieldSearch.toLowerCase()))
      )
      if (matchingFields.length > 0) {
        filtered[groupKey] = matchingFields
      }
    })
    return filtered
  }

  const handleExportWithCustomFields = () => {
    const exportData = searchResults.map((result, index) => {
      const row = { resultIndex: index }
      localSelectedFields.forEach(fieldKey => {
        row[fieldKey] = formatFieldValue({ ...result, resultIndex: index }, fieldKey)
      })
      return row
    })

    const enhancedOptions = {
      ...exportOptions,
      selectedFields: localSelectedFields,
      fieldConfigurations: Object.values(fieldGroups).flat()
    }

    onExport?.(exportFormat, exportData, enhancedOptions)
    onClose?.()
  }

  const getFieldTypeIcon = (type) => {
    switch (type) {
      case 'text': return '📝'
      case 'number': return '🔢'
      case 'datetime': return '📅'
      case 'boolean': return '☑️'
      default: return '📄'
    }
  }

  if (!isOpen) return null

  const filteredGroups = getFilteredGroups()

  return (
    <div className="custom-field-selector-overlay">
      <div className="custom-field-selector">
        <div className="selector-header">
          <h3>Výběr polí pro export</h3>
          <div className="header-controls">
            <span className="selected-count">
              {localSelectedFields.length} polí vybráno
            </span>
            <button className="close-button" onClick={onClose}>×</button>
          </div>
        </div>

        <div className="selector-body">
          <div className="selection-panel">
            <div className="search-and-controls">
              <input
                type="text"
                placeholder="Hledat pole..."
                value={fieldSearch}
                onChange={(e) => setFieldSearch(e.target.value)}
                className="field-search"
              />
              <div className="bulk-controls">
                <button onClick={handleSelectAll} className="control-button select">
                  Vše
                </button>
                <button onClick={handleSelectNone} className="control-button deselect">
                  Nic
                </button>
              </div>
            </div>

            <div className="field-groups">
              {Object.entries(filteredGroups).map(([groupKey, fields]) => (
                <div key={groupKey} className="field-group">
                  <div className="group-header">
                    <h4>{fieldGroupLabels[groupKey] || groupKey}</h4>
                    <div className="group-controls">
                      <button 
                        onClick={() => handleSelectGroup(groupKey)}
                        className="group-control select"
                        title="Vybrat skupinu"
                      >
                        +
                      </button>
                      <button 
                        onClick={() => handleDeselectGroup(groupKey)}
                        className="group-control deselect"
                        title="Zrušit výběr skupiny"
                      >
                        -
                      </button>
                    </div>
                  </div>
                  
                  <div className="group-fields">
                    {fields.map(field => (
                      <div key={field.key} className="field-option">
                        <label className="field-label">
                          <input
                            type="checkbox"
                            checked={localSelectedFields.includes(field.key)}
                            onChange={() => handleFieldToggle(field.key)}
                          />
                          <span className="field-info">
                            <span className="field-icon">{getFieldTypeIcon(field.type)}</span>
                            <span className="field-name">{field.label}</span>
                            <span className="field-type">({field.type})</span>
                          </span>
                        </label>
                        {field.description && (
                          <div className="field-description">{field.description}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="preview-panel">
            <h4>Náhled dat ({previewData.length} z {searchResults.length} řádků)</h4>
            {previewData.length > 0 ? (
              <div className="preview-table-container">
                <table className="preview-table">
                  <thead>
                    <tr>
                      {localSelectedFields.map(fieldKey => {
                        const field = Object.values(fieldGroups).flat().find(f => f.key === fieldKey)
                        return (
                          <th key={fieldKey} title={field?.description}>
                            {field?.label || fieldKey}
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.map((row, index) => (
                      <tr key={index}>
                        {localSelectedFields.map(fieldKey => (
                          <td key={fieldKey} className={`cell-${fieldKey}`}>
                            {String(row[fieldKey] || '').substring(0, 50)}
                            {String(row[fieldKey] || '').length > 50 && '...'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="no-preview">
                Vyberte pole pro zobrazení náhledu dat
              </div>
            )}
          </div>
        </div>

        <div className="export-options">
          <h4>Možnosti exportu</h4>
          <div className="options-grid">
            <label>
              <input
                type="checkbox"
                checked={exportOptions.includeHeaders}
                onChange={(e) => setExportOptions(prev => ({ ...prev, includeHeaders: e.target.checked }))}
              />
              Zahrnout záhlaví
            </label>
            
            <label>
              <input
                type="checkbox"
                checked={exportOptions.includeMetadata}
                onChange={(e) => setExportOptions(prev => ({ ...prev, includeMetadata: e.target.checked }))}
              />
              Zahrnout metadata
            </label>
            
            <label>
              <input
                type="checkbox"
                checked={exportOptions.includeTimestamp}
                onChange={(e) => setExportOptions(prev => ({ ...prev, includeTimestamp: e.target.checked }))}
              />
              Zahrnout časové razítko
            </label>

            <div className="option-group">
              <label>Max. počet řádků:</label>
              <input
                type="number"
                value={exportOptions.maxRows}
                onChange={(e) => setExportOptions(prev => ({ ...prev, maxRows: parseInt(e.target.value) || 1000 }))}
                min="1"
                max="10000"
              />
            </div>

            <div className="option-group">
              <label>Formát data:</label>
              <select
                value={exportOptions.dateFormat}
                onChange={(e) => setExportOptions(prev => ({ ...prev, dateFormat: e.target.value }))}
              >
                <option value="ISO">ISO (2024-01-15T10:30:00)</option>
                <option value="Czech">České (15.1.2024 10:30)</option>
                <option value="US">US (01/15/2024 10:30 AM)</option>
              </select>
            </div>

            <div className="option-group">
              <label>Formát čísel:</label>
              <select
                value={exportOptions.numberFormat}
                onChange={(e) => setExportOptions(prev => ({ ...prev, numberFormat: e.target.value }))}
              >
                <option value="decimal">Desetinné (3.14)</option>
                <option value="czech">České (3,14)</option>
                <option value="scientific">Vědecké (3.14E+00)</option>
              </select>
            </div>
          </div>
        </div>

        <div className="selector-footer">
          <div className="export-info">
            <span>Exportuje se {localSelectedFields.length} polí z {searchResults.length} výsledků</span>
          </div>
          <div className="footer-buttons">
            <button onClick={onClose} className="cancel-button">
              Zrušit
            </button>
            <button 
              onClick={handleExportWithCustomFields}
              disabled={localSelectedFields.length === 0}
              className="export-button primary"
            >
              Exportovat {exportFormat.toUpperCase()}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CustomFieldSelector
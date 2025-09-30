import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

/**
 * Comprehensive Export System for Contract Analysis
 * Supports CSV, Excel (.xlsx), and PDF exports with multiple data types
 */

export class ExportSystem {
  constructor() {
    this.formats = ['csv', 'xlsx', 'pdf']
    this.defaultOptions = {
      includeMetadata: true,
      includeTimestamp: true,
      companyName: 'Legal Document Analyzer',
      documentTitle: 'Contract Analysis Report'
    }
  }

  /**
   * Main export function - routes to appropriate format handler
   */
  async exportData(format, data, options = {}) {
    const mergedOptions = { ...this.defaultOptions, ...options }
    
    try {
      switch (format.toLowerCase()) {
        case 'csv':
          return this.exportToCSV(data, mergedOptions)
        case 'xlsx':
        case 'excel':
          return this.exportToExcel(data, mergedOptions)
        case 'pdf':
          return this.exportToPDF(data, mergedOptions)
        default:
          throw new Error(`Unsupported export format: ${format}`)
      }
    } catch (error) {
      console.error('Export error:', error)
      throw new Error(`Export failed: ${error.message}`)
    }
  }

  /**
   * Export to CSV format
   */
  exportToCSV(data, options) {
    if (!data || data.length === 0) {
      throw new Error('No data to export')
    }

    const headers = this.getCSVHeaders(data[0])
    const rows = data.map(item => this.formatRowForCSV(item, headers))
    
    let csvContent = headers.join(',') + '\\n'
    csvContent += rows.map(row => row.join(',')).join('\\n')

    // Add metadata if requested
    if (options.includeMetadata) {
      const metadata = this.generateMetadata(data, 'CSV')
      csvContent = metadata + '\\n\\n' + csvContent
    }

    this.downloadFile(csvContent, `contract-analysis-${this.getTimestamp()}.csv`, 'text/csv')
    return { success: true, format: 'CSV', recordCount: data.length }
  }

  /**
   * Export to Excel (.xlsx) format with multiple sheets and data types
   */
  exportToExcel(data, options) {
    if (!data || data.length === 0) {
      throw new Error('No data to export')
    }

    const workbook = XLSX.utils.book_new()

    // Main results sheet
    const resultsSheet = this.createExcelResultsSheet(data)
    XLSX.utils.book_append_sheet(workbook, resultsSheet, 'Search Results')

    // Summary sheet
    const summarySheet = this.createExcelSummarySheet(data, options)
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary')

    // Data types sheet
    const typesSheet = this.createExcelTypesSheet(data)
    XLSX.utils.book_append_sheet(workbook, typesSheet, 'Data Types')

    // Statistics sheet
    const statsSheet = this.createExcelStatsSheet(data)
    XLSX.utils.book_append_sheet(workbook, statsSheet, 'Statistics')

    // Convert to binary and download
    const excelBuffer = XLSX.write(workbook, { 
      bookType: 'xlsx', 
      type: 'array',
      cellStyles: true,
      sheetStubs: false
    })

    const blob = new Blob([excelBuffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    })
    
    this.downloadBlob(blob, `contract-analysis-${this.getTimestamp()}.xlsx`)
    return { success: true, format: 'Excel', recordCount: data.length, sheets: 4 }
  }

  /**
   * Export to PDF format with formatted tables and summaries
   */
  exportToPDF(data, options) {
    if (!data || data.length === 0) {
      throw new Error('No data to export')
    }

    const doc = new jsPDF('l', 'mm', 'a4') // Landscape orientation
    
    // Add header
    this.addPDFHeader(doc, options)
    
    // Add summary section
    this.addPDFSummary(doc, data, options)
    
    // Add main results table
    this.addPDFMainTable(doc, data)
    
    // Add data types analysis
    doc.addPage()
    this.addPDFDataTypesAnalysis(doc, data)
    
    // Add statistics
    this.addPDFStatistics(doc, data)
    
    // Save the PDF
    doc.save(`contract-analysis-${this.getTimestamp()}.pdf`)
    return { success: true, format: 'PDF', recordCount: data.length, pages: doc.getNumberOfPages() }
  }

  /**
   * CSV Helper Methods
   */
  getCSVHeaders(sampleItem) {
    return ['Dotaz', 'Popisek', 'Hodnota', 'Absolutní hodnota', 'Typ']
  }

  formatRowForCSV(item, headers) {
    const escapeCSV = (value) => {
      if (value === null || value === undefined) return ''
      const str = String(value)
      if (str.includes(',') || str.includes('"') || str.includes('\\n')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }

    return headers.map(header => {
      switch (header) {
        case 'Dotaz': return escapeCSV(item.query)
        case 'Popisek': return escapeCSV(item.label)
        case 'Hodnota': return escapeCSV(item.value)
        case 'Absolutní hodnota': return escapeCSV(item.absoluteValue)
        case 'Typ': return escapeCSV(item.type)
        default: return ''
      }
    })
  }

  /**
   * Excel Helper Methods
   */
  createExcelResultsSheet(data) {
    const headers = ['Dotaz', 'Popisek', 'Hodnota', 'Absolutní hodnota', 'Typ']

    const rows = data.map(item => [
      item.query || '',
      item.label || '',
      item.value || '',
      item.absoluteValue || '',
      item.type || ''
    ])

    const wsData = [headers, ...rows]
    const worksheet = XLSX.utils.aoa_to_sheet(wsData)

    // Set column widths
    worksheet['!cols'] = [
      { width: 25 }, // Dotaz
      { width: 20 }, // Popisek
      { width: 20 }, // Hodnota
      { width: 20 }, // Absolutní hodnota
      { width: 12 }  // Typ
    ]

    // Apply styles to header row
    const headerRange = XLSX.utils.decode_range(worksheet['!ref'])
    for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col })
      if (!worksheet[cellAddress]) continue
      worksheet[cellAddress].s = {
        font: { bold: true },
        fill: { fgColor: { rgb: 'E7E6E6' } },
        alignment: { horizontal: 'center' }
      }
    }

    return worksheet
  }

  createExcelSummarySheet(data, options) {
    const summary = this.generateDataSummary(data)
    
    const summaryData = [
      ['Contract Analysis Summary'],
      [''],
      ['Generated:', new Date().toLocaleString()],
      ['Company:', options.companyName],
      ['Total Records:', data.length],
      [''],
      ['Data Type Distribution:'],
      ...Object.entries(summary.typeDistribution).map(([type, count]) => [type, count]),
      [''],
      ['Confidence Statistics:'],
      ['Average Confidence:', summary.avgConfidence.toFixed(3)],
      ['Min Confidence:', summary.minConfidence.toFixed(3)],
      ['Max Confidence:', summary.maxConfidence.toFixed(3)],
      [''],
      ['Top Value Types:'],
      ...summary.topValueTypes.map(([type, count]) => [type, count])
    ]

    const worksheet = XLSX.utils.aoa_to_sheet(summaryData)
    worksheet['!cols'] = [{ width: 25 }, { width: 15 }]

    return worksheet
  }

  createExcelTypesSheet(data) {
    const typeAnalysis = this.analyzeDataTypes(data)
    
    const headers = ['Data Type', 'Count', 'Percentage', 'Sample Values', 'Avg Confidence']
    const rows = Object.entries(typeAnalysis).map(([type, info]) => [
      type,
      info.count,
      `${((info.count / data.length) * 100).toFixed(1)}%`,
      info.samples.slice(0, 3).join('; '),
      info.avgConfidence.toFixed(3)
    ])

    const wsData = [headers, ...rows]
    const worksheet = XLSX.utils.aoa_to_sheet(wsData)
    worksheet['!cols'] = [{ width: 15 }, { width: 8 }, { width: 12 }, { width: 40 }, { width: 15 }]

    return worksheet
  }

  createExcelStatsSheet(data) {
    const stats = this.calculateStatistics(data)
    
    const statsData = [
      ['Statistical Analysis'],
      [''],
      ['Record Count:', data.length],
      ['Unique Values:', stats.uniqueValues],
      ['Unique Types:', stats.uniqueTypes],
      ['Average Confidence:', stats.avgConfidence.toFixed(3)],
      ['Standard Deviation:', stats.stdDeviation.toFixed(3)],
      [''],
      ['Position Statistics:'],
      ['Min Position:', stats.minPosition],
      ['Max Position:', stats.maxPosition],
      ['Avg Position:', stats.avgPosition.toFixed(0)],
      [''],
      ['Match Statistics:'],
      ['Total Matches:', stats.totalMatches],
      ['Avg Matches per Result:', stats.avgMatchesPerResult.toFixed(1)],
      ['Max Matches:', stats.maxMatches]
    ]

    const worksheet = XLSX.utils.aoa_to_sheet(statsData)
    worksheet['!cols'] = [{ width: 25 }, { width: 15 }]

    return worksheet
  }

  /**
   * PDF Helper Methods
   */
  addPDFHeader(doc, options) {
    doc.setFontSize(20)
    doc.setFont('helvetica', 'bold')
    doc.text(options.documentTitle, 20, 20)
    
    doc.setFontSize(12)
    doc.setFont('helvetica', 'normal')
    doc.text(`Generated: ${new Date().toLocaleString()}`, 20, 30)
    doc.text(`Company: ${options.companyName}`, 20, 37)
    
    doc.setLineWidth(0.5)
    doc.line(20, 42, 277, 42) // Page width minus margins
  }

  addPDFSummary(doc, data, options) {
    const summary = this.generateDataSummary(data)
    
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('Executive Summary', 20, 55)
    
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    
    const summaryText = [
      `Total extracted records: ${data.length}`,
      `Average confidence: ${summary.avgConfidence.toFixed(1)}%`,
      `Most common data type: ${summary.topValueTypes[0]?.[0] || 'N/A'}`,
      `Confidence range: ${summary.minConfidence.toFixed(1)}% - ${summary.maxConfidence.toFixed(1)}%`
    ]
    
    summaryText.forEach((text, index) => {
      doc.text(text, 20, 65 + (index * 7))
    })
  }

  addPDFMainTable(doc, data) {
    const tableData = data.map(item => [
      (item.query || '').substring(0, 25) + (item.query?.length > 25 ? '...' : ''),
      (item.label || '').substring(0, 20) + (item.label?.length > 20 ? '...' : ''),
      (item.value || '').substring(0, 20) + (item.value?.length > 20 ? '...' : ''),
      item.absoluteValue || '',
      item.type || ''
    ])

    autoTable(doc, {
      head: [['Dotaz', 'Popisek', 'Hodnota', 'Absolutní hodnota', 'Typ']],
      body: tableData,
      startY: 95,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [200, 200, 200] },
      columnStyles: {
        0: { cellWidth: 45 },
        1: { cellWidth: 35 },
        2: { cellWidth: 35 },
        3: { cellWidth: 35 },
        4: { cellWidth: 20 }
      },
      margin: { left: 20, right: 20 }
    })
  }

  addPDFDataTypesAnalysis(doc, data) {
    const typeAnalysis = this.analyzeDataTypes(data)
    
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('Data Types Analysis', 20, 20)

    const typeTableData = Object.entries(typeAnalysis).map(([type, info]) => [
      type,
      info.count.toString(),
      `${((info.count / data.length) * 100).toFixed(1)}%`,
      info.avgConfidence.toFixed(3)
    ])

    autoTable(doc, {
      head: [['Data Type', 'Count', 'Percentage', 'Avg Confidence']],
      body: typeTableData,
      startY: 30,
      styles: { fontSize: 10 },
      headStyles: { fillColor: [200, 200, 200] }
    })
  }

  addPDFStatistics(doc, data) {
    const stats = this.calculateStatistics(data)
    const finalY = doc.lastAutoTable.finalY + 20

    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('Statistical Analysis', 20, finalY)

    const statsData = [
      ['Total Records', data.length],
      ['Unique Values', stats.uniqueValues],
      ['Average Confidence', stats.avgConfidence.toFixed(3)],
      ['Standard Deviation', stats.stdDeviation.toFixed(3)],
      ['Total Matches Found', stats.totalMatches]
    ]

    autoTable(doc, {
      body: statsData,
      startY: finalY + 10,
      styles: { fontSize: 10 },
      theme: 'plain'
    })
  }

  /**
   * Analysis Helper Methods
   */
  generateDataSummary(data) {
    const typeDistribution = {}
    const confidences = []
    const valueTypes = {}

    data.forEach(item => {
      // Type distribution
      const type = item.type || 'unknown'
      typeDistribution[type] = (typeDistribution[type] || 0) + 1

      // Confidence tracking
      if (typeof item.confidence === 'number') {
        confidences.push(item.confidence)
      }

      // Value type analysis
      const valueType = this.detectValueType(item.value)
      valueTypes[valueType] = (valueTypes[valueType] || 0) + 1
    })

    const avgConfidence = confidences.length > 0 
      ? confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length 
      : 0

    return {
      typeDistribution,
      avgConfidence: avgConfidence * 100,
      minConfidence: Math.min(...confidences) * 100,
      maxConfidence: Math.max(...confidences) * 100,
      topValueTypes: Object.entries(valueTypes)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
    }
  }

  analyzeDataTypes(data) {
    const analysis = {}

    data.forEach(item => {
      const type = item.type || 'unknown'
      
      if (!analysis[type]) {
        analysis[type] = {
          count: 0,
          samples: [],
          confidences: []
        }
      }

      analysis[type].count++
      
      if (analysis[type].samples.length < 5 && item.value) {
        analysis[type].samples.push(item.value)
      }
      
      if (typeof item.confidence === 'number') {
        analysis[type].confidences.push(item.confidence)
      }
    })

    // Calculate averages
    Object.keys(analysis).forEach(type => {
      const typeData = analysis[type]
      typeData.avgConfidence = typeData.confidences.length > 0
        ? typeData.confidences.reduce((sum, conf) => sum + conf, 0) / typeData.confidences.length
        : 0
    })

    return analysis
  }

  calculateStatistics(data) {
    const values = data.map(item => item.value).filter(Boolean)
    const confidences = data.map(item => item.confidence).filter(conf => typeof conf === 'number')
    const positions = data.map(item => item.startPosition).filter(pos => typeof pos === 'number')
    const matchCounts = data.map(item => item.matchCount).filter(count => typeof count === 'number')

    const avgConfidence = confidences.length > 0
      ? confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length
      : 0

    const variance = confidences.length > 0
      ? confidences.reduce((sum, conf) => sum + Math.pow(conf - avgConfidence, 2), 0) / confidences.length
      : 0

    return {
      uniqueValues: new Set(values).size,
      uniqueTypes: new Set(data.map(item => item.type)).size,
      avgConfidence,
      stdDeviation: Math.sqrt(variance),
      minPosition: Math.min(...positions),
      maxPosition: Math.max(...positions),
      avgPosition: positions.reduce((sum, pos) => sum + pos, 0) / positions.length,
      totalMatches: matchCounts.reduce((sum, count) => sum + count, 0),
      avgMatchesPerResult: matchCounts.reduce((sum, count) => sum + count, 0) / matchCounts.length,
      maxMatches: Math.max(...matchCounts)
    }
  }

  detectValueType(value) {
    if (!value) return 'empty'
    
    const str = String(value)
    if (/^\d{6}\/\d{3,4}$/.test(str)) return 'birthNumber'
    if (/^\d+(?:[.,]\d+)?\s*(?:Kč|CZK|€|EUR)$/i.test(str)) return 'currency'
    if (/^(\+420\s?)?\d{3}\s?\d{3}\s?\d{3}$/.test(str)) return 'phone'
    if (/^[A-Z][a-z]+\s+[A-Z][a-z]+$/.test(str)) return 'name'
    if (/^\d+$/.test(str)) return 'number'
    if (/^\d+\/\d+$/.test(str)) return 'fraction'
    
    return 'text'
  }

  /**
   * Utility Methods
   */
  generateMetadata(data, format) {
    return [
      `# ${format} Export Metadata`,
      `# Generated: ${new Date().toISOString()}`,
      `# Records: ${data.length}`,
      `# Export System: Legal Document Analyzer`,
      `# Format: ${format}`
    ].join('\\n')
  }

  getTimestamp() {
    return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  }

  downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType })
    this.downloadBlob(blob, filename)
  }

  downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }
}

// Export singleton instance
export const exportSystem = new ExportSystem()

// Export individual functions for convenience
export const exportToCSV = (data, options) => exportSystem.exportToCSV(data, options)
export const exportToExcel = (data, options) => exportSystem.exportToExcel(data, options)
export const exportToPDF = (data, options) => exportSystem.exportToPDF(data, options)

export default exportSystem
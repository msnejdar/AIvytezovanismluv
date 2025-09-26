import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  FileText, 
  Search, 
  Highlight, 
  Eye, 
  EyeOff, 
  ZoomIn, 
  ZoomOut, 
  Settings,
  Download,
  Copy,
  Share,
  BookOpen,
  MapPin,
  Tag
} from 'lucide-react'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card'
import { LoadingSpinner } from '../ui/LoadingSpinner'
import { cn } from '../../utils/cn'
import { fadeInUp, scaleIn } from '../../utils/animations'

interface HighlightRange {
  id: string
  start: number
  end: number
  text: string
  type?: string
  confidence?: number
  label?: string
  resultId?: string
  context?: string
}

interface Annotation {
  id: string
  range: HighlightRange
  note: string
  author?: string
  timestamp: number
  resolved?: boolean
}

interface EnhancedDocumentViewerProps {
  document: string
  highlightRanges?: HighlightRange[]
  activeRangeId?: string | null
  annotations?: Annotation[]
  isLoading?: boolean
  readOnly?: boolean
  showLineNumbers?: boolean
  showMinimap?: boolean
  fontSize?: number
  onRangeClick?: (range: HighlightRange) => void
  onAnnotationAdd?: (range: HighlightRange, note: string) => void
  onAnnotationEdit?: (annotation: Annotation) => void
  onAnnotationDelete?: (annotationId: string) => void
  onDocumentChange?: (document: string) => void
  className?: string
}

interface HighlightType {
  id: string
  label: string
  color: string
  borderColor: string
  icon: React.ReactNode
}

const highlightTypes: HighlightType[] = [
  {
    id: 'birth-number',
    label: 'Rodné číslo',
    color: 'bg-green-500/20 text-green-800',
    borderColor: 'border-green-500',
    icon: <Tag size={12} />,
  },
  {
    id: 'amount',
    label: 'Částka',
    color: 'bg-orange-500/20 text-orange-800',
    borderColor: 'border-orange-500',
    icon: <MapPin size={12} />,
  },
  {
    id: 'name',
    label: 'Jméno',
    color: 'bg-blue-500/20 text-blue-800',
    borderColor: 'border-blue-500',
    icon: <BookOpen size={12} />,
  },
  {
    id: 'phone',
    label: 'Telefon',
    color: 'bg-purple-500/20 text-purple-800',
    borderColor: 'border-purple-500',
    icon: <Search size={12} />,
  },
  {
    id: 'date',
    label: 'Datum',
    color: 'bg-cyan-500/20 text-cyan-800',
    borderColor: 'border-cyan-500',
    icon: <FileText size={12} />,
  },
]

export const EnhancedDocumentViewer: React.FC<EnhancedDocumentViewerProps> = ({
  document,
  highlightRanges = [],
  activeRangeId,
  annotations = [],
  isLoading = false,
  readOnly = false,
  showLineNumbers = true,
  showMinimap = false,
  fontSize = 14,
  onRangeClick,
  onAnnotationAdd,
  onAnnotationEdit,
  onAnnotationDelete,
  onDocumentChange,
  className,
}) => {
  const [zoomLevel, setZoomLevel] = React.useState(100)
  const [showAnnotations, setShowAnnotations] = React.useState(true)
  const [selectedText, setSelectedText] = React.useState('')
  const [selectionRange, setSelectionRange] = React.useState<{ start: number; end: number } | null>(null)
  const [showAddAnnotation, setShowAddAnnotation] = React.useState(false)
  const [annotationNote, setAnnotationNote] = React.useState('')
  
  const containerRef = React.useRef<HTMLDivElement>(null)
  const contentRef = React.useRef<HTMLDivElement>(null)

  // Handle text selection for annotations
  const handleTextSelection = () => {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0 || readOnly) return

    const range = selection.getRangeAt(0)
    const selectedText = selection.toString().trim()
    
    if (selectedText.length > 0 && contentRef.current?.contains(range.commonAncestorContainer)) {
      // Calculate position relative to document content
      const container = contentRef.current
      const walker = document.createTreeWalker(
        container,
        NodeFilter.SHOW_TEXT,
        null
      )

      let textOffset = 0
      let node
      while (node = walker.nextNode()) {
        if (node === range.startContainer) {
          break
        }
        textOffset += node.textContent?.length || 0
      }

      const start = textOffset + range.startOffset
      const end = textOffset + range.endOffset

      setSelectedText(selectedText)
      setSelectionRange({ start, end })
      setShowAddAnnotation(true)
    }
  }

  // Render highlighted document with proper HTML structure
  const renderHighlightedDocument = () => {
    if (!document) return ''

    // Sort ranges by start position (descending for proper insertion)
    const sortedRanges = [...highlightRanges].sort((a, b) => b.start - a.start)
    
    let result = document
    const rangeElements: Array<{ element: JSX.Element; position: number }> = []

    // Process each highlight range
    sortedRanges.forEach((range, index) => {
      const isActive = range.id === activeRangeId
      const highlightType = highlightTypes.find(type => 
        range.type?.includes(type.id) || range.label?.toLowerCase().includes(type.id.replace('-', ''))
      ) || highlightTypes[0]

      const confidenceLevel = range.confidence || 1
      const confidenceClass = 
        confidenceLevel > 0.8 ? 'ring-2 ring-legal-gold/50' :
        confidenceLevel > 0.6 ? 'ring-1 ring-legal-gold/30' : ''

      const highlightElement = (
        <motion.mark
          key={range.id}
          data-highlight-id={range.id}
          data-result-id={range.resultId}
          className={cn(
            'inline-block px-2 py-1 rounded-md cursor-pointer transition-all duration-200',
            highlightType.color,
            highlightType.borderColor,
            'border',
            confidenceClass,
            isActive && 'ring-2 ring-blue-400 shadow-lg scale-105',
            'hover:shadow-md hover:scale-102'
          )}
          onClick={() => onRangeClick?.(range)}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          layout
        >
          {range.text}
          {range.confidence && (
            <Badge 
              size="sm" 
              variant="outline" 
              className="ml-1 text-xs"
            >
              {Math.round(range.confidence * 100)}%
            </Badge>
          )}
        </motion.mark>
      )

      rangeElements.push({
        element: highlightElement,
        position: range.start
      })
    })

    // Split document into lines for line numbers
    const lines = document.split('\n')
    
    return (
      <div className="space-y-1">
        {lines.map((line, lineIndex) => (
          <div key={lineIndex} className="flex">
            {showLineNumbers && (
              <div className="w-12 text-right pr-4 text-xs text-legal-text-muted select-none">
                {lineIndex + 1}
              </div>
            )}
            <div 
              className="flex-1 min-h-[1.5rem]"
              dangerouslySetInnerHTML={{
                __html: renderLineWithHighlights(line, lineIndex, lines)
              }}
            />
          </div>
        ))}
      </div>
    )
  }

  const renderLineWithHighlights = (line: string, lineIndex: number, allLines: string[]) => {
    // Calculate line start position in the full document
    const lineStart = allLines.slice(0, lineIndex).reduce((acc, l) => acc + l.length + 1, 0)
    const lineEnd = lineStart + line.length

    // Find highlights that intersect with this line
    const lineHighlights = highlightRanges.filter(range => 
      range.start < lineEnd && range.end > lineStart
    )

    if (lineHighlights.length === 0) {
      return escapeHtml(line)
    }

    // Process highlights for this line
    let result = line
    const adjustedHighlights = lineHighlights
      .map(range => ({
        ...range,
        localStart: Math.max(0, range.start - lineStart),
        localEnd: Math.min(line.length, range.end - lineStart)
      }))
      .sort((a, b) => b.localStart - a.localStart)

    adjustedHighlights.forEach(range => {
      const before = result.substring(0, range.localStart)
      const highlighted = result.substring(range.localStart, range.localEnd)
      const after = result.substring(range.localEnd)

      const isActive = range.id === activeRangeId
      const highlightType = highlightTypes.find(type => 
        range.type?.includes(type.id) || range.label?.toLowerCase().includes(type.id.replace('-', ''))
      ) || highlightTypes[0]

      result = `${before}<mark 
        data-highlight-id="${range.id}" 
        data-result-id="${range.resultId || ''}"
        class="px-2 py-1 rounded-md cursor-pointer transition-all duration-200 ${highlightType.color} ${highlightType.borderColor} border ${isActive ? 'ring-2 ring-blue-400 shadow-lg' : ''} hover:shadow-md hover:scale-102"
        onclick="handleHighlightClick('${range.id}')"
      >${escapeHtml(highlighted)}</mark>${after}`
    })

    return result
  }

  const escapeHtml = (text: string) => {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }

  const handleZoom = (direction: 'in' | 'out') => {
    setZoomLevel(prev => {
      const newLevel = direction === 'in' ? prev + 10 : prev - 10
      return Math.max(50, Math.min(200, newLevel))
    })
  }

  const handleCopyDocument = () => {
    navigator.clipboard.writeText(document)
  }

  const addAnnotation = () => {
    if (!selectionRange || !annotationNote.trim()) return

    const newRange: HighlightRange = {
      id: `annotation-${Date.now()}`,
      start: selectionRange.start,
      end: selectionRange.end,
      text: selectedText,
      type: 'annotation',
      label: 'Poznámka'
    }

    const newAnnotation: Annotation = {
      id: `note-${Date.now()}`,
      range: newRange,
      note: annotationNote,
      timestamp: Date.now(),
      resolved: false
    }

    onAnnotationAdd?.(newRange, annotationNote)
    setShowAddAnnotation(false)
    setAnnotationNote('')
    setSelectedText('')
    setSelectionRange(null)
  }

  if (isLoading) {
    return (
      <motion.div
        className={cn('flex items-center justify-center h-96', className)}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div className="text-center space-y-4">
          <LoadingSpinner size="lg" variant="dots" />
          <p className="text-legal-text-muted">Načítání dokumentu...</p>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      className={cn('flex flex-col h-full', className)}
      variants={fadeInUp}
      initial="initial"
      animate="animate"
    >
      {/* Toolbar */}
      <motion.div 
        className="flex items-center justify-between p-4 border-b border-legal-gold/20 bg-gradient-to-r from-legal-navy/20 to-legal-blue/10"
        variants={scaleIn}
      >
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <FileText size={20} className="text-legal-gold" />
            <span className="font-medium text-legal-text-light">
              Dokument ({document.length.toLocaleString()} znaků)
            </span>
          </div>
          
          {highlightRanges.length > 0 && (
            <Badge variant="premium" animated>
              {highlightRanges.length} zvýraznění
            </Badge>
          )}
        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleZoom('out')}
            disabled={zoomLevel <= 50}
            icon={<ZoomOut size={14} />}
          />
          <span className="text-sm text-legal-text-muted min-w-[3rem] text-center">
            {zoomLevel}%
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleZoom('in')}
            disabled={zoomLevel >= 200}
            icon={<ZoomIn size={14} />}
          />

          <div className="w-px h-6 bg-legal-gold/20" />

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAnnotations(!showAnnotations)}
            icon={showAnnotations ? <EyeOff size={14} /> : <Eye size={14} />}
          >
            Poznámky
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopyDocument}
            icon={<Copy size={14} />}
          />
        </div>
      </motion.div>

      {/* Document Content */}
      <div className="flex-1 flex overflow-hidden">
        <motion.div
          ref={containerRef}
          className="flex-1 overflow-auto p-6"
          style={{ fontSize: `${(fontSize * zoomLevel) / 100}px` }}
          variants={fadeInUp}
        >
          {!readOnly ? (
            <textarea
              value={document}
              onChange={(e) => onDocumentChange?.(e.target.value)}
              className="w-full h-full bg-transparent text-legal-text-light border-none outline-none resize-none font-mono leading-relaxed"
              placeholder="Vložte zde obsah dokumentu..."
            />
          ) : (
            <div
              ref={contentRef}
              className="text-legal-text-light leading-relaxed font-serif whitespace-pre-wrap cursor-text"
              onMouseUp={handleTextSelection}
              dangerouslySetInnerHTML={{
                __html: renderHighlightedDocument()
              }}
            />
          )}
        </motion.div>

        {/* Minimap */}
        {showMinimap && document && (
          <motion.div
            className="w-48 border-l border-legal-gold/20 bg-legal-navy/10 p-2"
            variants={scaleIn}
          >
            <div className="text-xs text-legal-text-muted mb-2">Přehled dokumentu</div>
            <div className="space-y-1 max-h-96 overflow-y-auto">
              {highlightRanges.map((range, index) => (
                <motion.div
                  key={range.id}
                  className={cn(
                    'p-2 rounded text-xs cursor-pointer transition-colors',
                    range.id === activeRangeId
                      ? 'bg-legal-gold/20 border border-legal-gold'
                      : 'bg-legal-navy/20 hover:bg-legal-navy/30'
                  )}
                  onClick={() => onRangeClick?.(range)}
                  whileHover={{ scale: 1.02 }}
                >
                  <div className="font-medium text-legal-text-light truncate">
                    {range.label || 'Výsledek'}
                  </div>
                  <div className="text-legal-text-muted truncate">
                    {range.text}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </div>

      {/* Add Annotation Modal */}
      <AnimatePresence>
        {showAddAnnotation && (
          <motion.div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-gradient-to-br from-legal-navy to-legal-blue p-6 rounded-lg border border-legal-gold max-w-md w-full mx-4"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <h3 className="text-lg font-semibold text-legal-text-light mb-4">
                Přidat poznámku
              </h3>
              
              <div className="mb-4">
                <div className="text-sm text-legal-text-muted mb-2">Vybraný text:</div>
                <div className="p-3 bg-legal-gold/10 rounded border border-legal-gold/30 text-legal-text-light">
                  "{selectedText}"
                </div>
              </div>
              
              <textarea
                value={annotationNote}
                onChange={(e) => setAnnotationNote(e.target.value)}
                placeholder="Napište poznámku..."
                className="w-full h-24 p-3 bg-legal-navy/20 border border-legal-gold/30 rounded text-legal-text-light placeholder:text-legal-text-muted resize-none"
                autoFocus
              />
              
              <div className="flex space-x-2 mt-4">
                <Button
                  onClick={addAnnotation}
                  disabled={!annotationNote.trim()}
                  className="flex-1"
                >
                  Přidat poznámku
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAddAnnotation(false)
                    setAnnotationNote('')
                    setSelectedText('')
                    setSelectionRange(null)
                  }}
                >
                  Zrušit
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
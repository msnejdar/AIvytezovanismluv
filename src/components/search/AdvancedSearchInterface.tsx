import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Search, 
  Filter, 
  X, 
  Settings, 
  Clock, 
  ChevronDown,
  Zap,
  Brain,
  FileText,
  Target
} from 'lucide-react'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card'
import { LoadingSpinner } from '../ui/LoadingSpinner'
import { cn } from '../../utils/cn'
import { fadeInUp, staggerChildren } from '../../utils/animations'

interface SearchFilter {
  id: string
  label: string
  type: 'text' | 'select' | 'date' | 'number'
  options?: { value: string; label: string }[]
  value?: string | number
}

interface SearchMode {
  id: string
  label: string
  description: string
  icon: React.ReactNode
  color: string
}

interface AdvancedSearchInterfaceProps {
  query: string
  onQueryChange: (query: string) => void
  onSearch: () => void
  isSearching: boolean
  searchMode: string
  onSearchModeChange: (mode: string) => void
  filters?: SearchFilter[]
  onFiltersChange?: (filters: SearchFilter[]) => void
  recentSearches?: string[]
  onRecentSearchClick?: (query: string) => void
  onClearHistory?: () => void
  suggestions?: string[]
  disabled?: boolean
}

const searchModes: SearchMode[] = [
  {
    id: 'contract',
    label: 'Smlouvy',
    description: 'Specializované vyhledávání v právních dokumentech',
    icon: <FileText size={16} />,
    color: 'from-blue-500 to-blue-600',
  },
  {
    id: 'intelligent',
    label: 'Inteligentní',
    description: 'Kombinuje více vyhledávacích strategií',
    icon: <Brain size={16} />,
    color: 'from-purple-500 to-purple-600',
  },
  {
    id: 'fuzzy',
    label: 'Fuzzy',
    description: 'Tolerantní vyhledávání s překlepy',
    icon: <Target size={16} />,
    color: 'from-green-500 to-green-600',
  },
  {
    id: 'semantic',
    label: 'Sémantické',
    description: 'Vyhledávání podle významu',
    icon: <Zap size={16} />,
    color: 'from-orange-500 to-orange-600',
  },
]

export const AdvancedSearchInterface: React.FC<AdvancedSearchInterfaceProps> = ({
  query,
  onQueryChange,
  onSearch,
  isSearching,
  searchMode,
  onSearchModeChange,
  filters = [],
  onFiltersChange,
  recentSearches = [],
  onRecentSearchClick,
  onClearHistory,
  suggestions = [],
  disabled = false,
}) => {
  const [showFilters, setShowFilters] = React.useState(false)
  const [showModeSelector, setShowModeSelector] = React.useState(false)
  const [showSuggestions, setShowSuggestions] = React.useState(false)
  const [localQuery, setLocalQuery] = React.useState(query)

  const inputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    setLocalQuery(query)
  }, [query])

  const handleQueryChange = (value: string) => {
    setLocalQuery(value)
    onQueryChange(value)
    setShowSuggestions(value.length > 0 && suggestions.length > 0)
  }

  const handleSearch = () => {
    if (localQuery.trim()) {
      onSearch()
      setShowSuggestions(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSearch()
    }
    if (e.key === 'Escape') {
      setShowSuggestions(false)
      setShowModeSelector(false)
    }
  }

  const clearQuery = () => {
    setLocalQuery('')
    onQueryChange('')
    setShowSuggestions(false)
    inputRef.current?.focus()
  }

  const currentMode = searchModes.find(mode => mode.id === searchMode) || searchModes[0]

  return (
    <motion.div
      className="space-y-4"
      variants={staggerChildren}
      initial="initial"
      animate="animate"
    >
      {/* Main Search Input */}
      <motion.div variants={fadeInUp} className="relative">
        <div className="flex space-x-2">
          <div className="flex-1 relative">
            <Input
              ref={inputRef}
              value={localQuery}
              onChange={(e) => handleQueryChange(e.target.value)}
              onKeyDown={handleKeyPress}
              onFocus={() => setShowSuggestions(localQuery.length > 0 && suggestions.length > 0)}
              placeholder="Vyhledávat v dokumentech: osobní údaje, částky, termíny..."
              size="lg"
              icon={<Search size={20} />}
              clearable
              onClear={clearQuery}
              disabled={disabled}
              className="pr-32"
            />
            
            {/* Search Mode Button */}
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center space-x-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowModeSelector(!showModeSelector)}
                className="h-8 px-2 text-xs"
                disabled={disabled}
              >
                <span className="flex items-center space-x-1">
                  {currentMode.icon}
                  <span className="hidden sm:inline">{currentMode.label}</span>
                  <ChevronDown size={12} />
                </span>
              </Button>
            </div>

            {/* Search Mode Selector */}
            <AnimatePresence>
              {showModeSelector && (
                <motion.div
                  className="absolute right-0 top-full mt-2 w-80 z-50"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <Card variant="elevated">
                    <CardHeader>
                      <CardTitle className="text-sm">Režim vyhledávání</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {searchModes.map((mode) => (
                          <motion.button
                            key={mode.id}
                            onClick={() => {
                              onSearchModeChange(mode.id)
                              setShowModeSelector(false)
                            }}
                            className={cn(
                              'w-full p-3 rounded-lg border text-left transition-all',
                              'hover:border-legal-gold/50 hover:bg-legal-gold/5',
                              mode.id === searchMode
                                ? 'border-legal-gold bg-legal-gold/10'
                                : 'border-legal-gold/20'
                            )}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                          >
                            <div className="flex items-start space-x-3">
                              <div className={cn(
                                'p-2 rounded-lg bg-gradient-to-r',
                                mode.color
                              )}>
                                {mode.icon}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-legal-text-light">
                                  {mode.label}
                                </div>
                                <div className="text-xs text-legal-text-muted mt-1">
                                  {mode.description}
                                </div>
                              </div>
                            </div>
                          </motion.button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Search Suggestions */}
            <AnimatePresence>
              {showSuggestions && suggestions.length > 0 && (
                <motion.div
                  className="absolute left-0 right-0 top-full mt-2 z-40"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <Card variant="elevated">
                    <CardContent className="p-0">
                      <div className="max-h-60 overflow-y-auto">
                        {suggestions.map((suggestion, index) => (
                          <motion.button
                            key={index}
                            onClick={() => {
                              handleQueryChange(suggestion)
                              setShowSuggestions(false)
                              handleSearch()
                            }}
                            className="w-full p-3 text-left hover:bg-legal-gold/5 border-b border-legal-gold/10 last:border-b-0 transition-colors"
                            whileHover={{ backgroundColor: 'rgba(212, 175, 55, 0.05)' }}
                          >
                            <div className="flex items-center space-x-2">
                              <Search size={14} className="text-legal-text-muted" />
                              <span className="text-legal-text-light">{suggestion}</span>
                            </div>
                          </motion.button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <Button
            onClick={handleSearch}
            disabled={disabled || isSearching || !localQuery.trim()}
            loading={isSearching}
            size="lg"
            className="px-8"
          >
            {isSearching ? 'Vyhledávám...' : 'Vyhledat'}
          </Button>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              icon={<Filter size={14} />}
              disabled={disabled}
            >
              Filtry
            </Button>
            
            {filters.some(f => f.value) && (
              <Badge variant="secondary" animated>
                {filters.filter(f => f.value).length} aktivních filtrů
              </Badge>
            )}
          </div>

          {recentSearches.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearHistory}
              icon={<Clock size={14} />}
              disabled={disabled}
            >
              Historie
            </Button>
          )}
        </div>
      </motion.div>

      {/* Advanced Filters */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            variants={fadeInUp}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Pokročilé filtry</CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowFilters(false)}
                    icon={<X size={14} />}
                  />
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filters.map((filter) => (
                    <div key={filter.id}>
                      <label className="block text-sm font-medium text-legal-gold mb-2">
                        {filter.label}
                      </label>
                      {filter.type === 'text' && (
                        <Input
                          value={filter.value as string || ''}
                          onChange={(e) => {
                            if (onFiltersChange) {
                              const newFilters = filters.map(f =>
                                f.id === filter.id ? { ...f, value: e.target.value } : f
                              )
                              onFiltersChange(newFilters)
                            }
                          }}
                          placeholder={`Zadejte ${filter.label.toLowerCase()}`}
                          size="sm"
                        />
                      )}
                      {filter.type === 'select' && filter.options && (
                        <select
                          value={filter.value as string || ''}
                          onChange={(e) => {
                            if (onFiltersChange) {
                              const newFilters = filters.map(f =>
                                f.id === filter.id ? { ...f, value: e.target.value } : f
                              )
                              onFiltersChange(newFilters)
                            }
                          }}
                          className="w-full h-8 px-3 text-sm bg-legal-navy/20 border border-legal-gold/30 rounded-lg text-legal-text-light focus:outline-none focus:border-legal-gold"
                        >
                          <option value="">Vyberte...</option>
                          {filter.options.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recent Searches */}
      {recentSearches.length > 0 && (
        <motion.div variants={fadeInUp}>
          <Card variant="glass">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Nedávné vyhledávání</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClearHistory}
                  className="text-xs"
                >
                  Vymazat vše
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {recentSearches.slice(0, 5).map((search, index) => (
                  <Badge
                    key={index}
                    variant="outline"
                    className="cursor-pointer hover:bg-legal-gold/10"
                    onClick={() => onRecentSearchClick?.(search)}
                    animated
                  >
                    {search}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </motion.div>
  )
}
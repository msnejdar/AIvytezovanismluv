// TypeScript type definitions for AI Search Intelligence system

/**
 * Core data types
 */
export type ValueType = 
  | 'birthNumber'
  | 'iban'
  | 'bankAccount'
  | 'amount'
  | 'rpsn'
  | 'date'
  | 'phone'
  | 'name'
  | 'address'
  | 'text'
  | 'unknown';

export type SearchStrategy = 'exact' | 'fuzzy' | 'semantic' | 'hybrid';

export type HighlightType = 
  | 'primary'
  | 'secondary'
  | 'context'
  | 'error'
  | 'birth-number'
  | 'amount'
  | 'name'
  | 'phone'
  | 'date';

/**
 * Document normalization types
 */
export interface NormalizedDocument {
  normalized: string;
  indexMap: number[];
  reverseMap: Map<number, number[]>;
  withoutMarkdown?: string;
}

export interface IndexRange {
  start: number;
  end: number;
}

/**
 * Search match types
 */
export interface SearchMatch {
  start: number;
  end: number;
  text: string;
  id?: string;
  resultId?: string;
  confidence?: number;
  score?: number;
  type?: ValueType;
  context?: string;
  normalizedStart?: number;
  normalizedEnd?: number;
}

export interface FuzzyMatch extends SearchMatch {
  algorithm: 'levenshtein' | 'jaro' | 'jaroWinkler' | 'hybrid';
  fuzzyScore: number;
  distance?: number;
}

export interface SemanticMatch extends SearchMatch {
  semanticScore: number;
  expandedTerms?: string[];
  matchedTerms: number;
  totalTerms: number;
  intents?: DetectedIntent[];
}

/**
 * Search result types
 */
export interface SearchResult {
  id: string | number;
  label?: string;
  value: string;
  content?: string;
  matches: SearchMatch[];
  highlight?: string | string[];
  error?: boolean;
  relevanceScore?: number;
  ranking?: ResultRanking;
  scoreComponents?: ScoreComponents;
  similarResults?: SearchResult[];
}

export interface ResultRanking {
  position: number;
  confidence: number;
  groupScore?: number;
}

export interface ScoreComponents {
  exact?: number;
  fuzzy?: number;
  semantic?: number;
  positional?: number;
  context?: number;
  dataType?: number;
  coverage?: number;
}

/**
 * Query processing types
 */
export interface ProcessedQuery {
  normalized: string;
  terms: string[];
  hash: string;
  original: string;
  expandedTerms?: string[];
  intents?: DetectedIntent[];
}

export interface DetectedIntent {
  intent: 'search' | 'amount' | 'person' | 'date' | 'location' | 'phone' | 'document' | 'general';
  confidence: number;
  matches: string[];
}

/**
 * Fuzzy search options and results
 */
export interface FuzzySearchOptions {
  algorithm?: 'levenshtein' | 'jaro' | 'jaroWinkler' | 'hybrid';
  threshold?: number;
  caseSensitive?: boolean;
  diacriticSensitive?: boolean;
  minScore?: number;
  maxResults?: number;
  contextLength?: number;
  wordBoundary?: boolean;
  timeout?: number;
  quickMode?: boolean;
  substitutions?: Record<string, string>;
}

export interface FuzzySearchResult extends FuzzyMatch {
  contextStart?: number;
  contextEnd?: number;
  algorithms?: string[];
  combinedScore?: number;
  weightedScore?: number;
}

/**
 * Semantic search types
 */
export interface SemanticSearchOptions {
  maxResults?: number;
  minScore?: number;
  useExpansion?: boolean;
  contextWindow?: number;
  semanticAnalysis?: boolean;
  focusPatterns?: RegExp[];
}

export interface SemanticSearchResult {
  docId: string | number;
  score: number;
  matchedTerms: number;
  totalTerms: number;
  coverage: number;
  matches: SemanticMatch[];
  text: string;
  label: string;
  intents?: DetectedIntent[];
  primaryIntent?: string;
}

/**
 * Highlighting types
 */
export interface HighlightRange {
  start: number;
  end: number;
  id?: string;
  resultId?: string;
  type?: HighlightType | ValueType;
  confidence?: number;
  score?: number;
  text?: string;
  cssClass?: string;
  mergedRanges?: number[];
  priority?: number;
  originalIndex?: number;
}

export interface HighlightOptions {
  preserveFormatting?: boolean;
  addDataAttributes?: boolean;
  highlightTag?: string;
  customRenderer?: HighlightRenderer;
  contextualStyling?: boolean;
  mergeAdjacent?: boolean;
  adjacentThreshold?: number;
  prioritizeType?: 'score' | 'length' | 'position';
  activeRangeId?: string;
  contextPadding?: number;
  maxContextLength?: number;
  showEllipsis?: boolean;
  preserveOriginalFormatting?: boolean;
  chunkSize?: number;
  maxChunks?: number;
  addAriaLabels?: boolean;
  addScreenReaderText?: boolean;
  highlightRole?: string;
  accessible?: boolean;
  contextual?: boolean;
}

export type HighlightRenderer = (
  text: string,
  range: HighlightRange,
  attributes: string
) => string;

export interface TextSegment {
  text: string;
  type: 'text' | 'highlight';
  start: number;
  end: number;
  range?: HighlightRange;
}

/**
 * Performance optimization types
 */
export interface CacheStats {
  size: number;
  maxSize: number;
  ttl: number;
  hitRate?: number;
}

export interface PerformanceMetric {
  operation: string;
  context: Record<string, any>;
  startTime: number;
  endTime?: number;
  duration?: number;
}

export interface MemoryStats {
  available: boolean;
  used?: number;
  total?: number;
  limit?: number;
  cacheStats?: {
    search: CacheStats;
    document: CacheStats;
    normalization: CacheStats;
  };
}

export interface ThrottlerStats {
  currentRequests: number;
  limit: number;
  burstCount: number;
  burstLimit: number;
  canMakeRequest: boolean;
}

export interface DebouncerOptions {
  delay?: number;
  maxDelay?: number;
  strategy?: 'leading' | 'trailing' | 'both';
}

export interface BatchProcessorOptions {
  batchSize?: number;
  maxWait?: number;
}

/**
 * Ranking and scoring types
 */
export interface RankingWeights {
  exactMatch: number;
  fuzzyMatch: number;
  semanticMatch: number;
  partialMatch: number;
  earlyPosition: number;
  documentStart: number;
  lineStart: number;
  contextRelevance: number;
  fieldTypeMatch: number;
  dataTypeMatch: number;
  termCoverage: number;
  queryLength: number;
  intentAlignment: number;
  documentStructure: number;
  dataQuality: number;
  completeness: number;
}

export interface RankingOptions {
  maxResults?: number;
  diversityBonus?: boolean;
  groupSimilar?: boolean;
  minScore?: number;
  enableFuzzy?: boolean;
  enableSemantic?: boolean;
  enablePositional?: boolean;
  enableContext?: boolean;
  enableDataType?: boolean;
  weights?: Partial<RankingWeights>;
  contextWindow?: number;
  semanticAnalysis?: boolean;
  documentLength?: number;
  favorEarly?: boolean;
  caseSensitive?: boolean;
  diacriticSensitive?: boolean;
  wordBoundary?: boolean;
  similarityThreshold?: number;
}

export interface RelevanceScore {
  score: number;
  components: ScoreComponents;
  componentCount: number;
  detectedType: ValueType;
}

/**
 * Document and validation types
 */
export interface Document {
  id: string | number;
  text: string;
  label?: string;
  metadata?: Record<string, any>;
}

export interface ValidationResult {
  isValid: boolean;
  type: ValueType;
  normalizedValue?: string;
  confidence?: number;
  errors?: string[];
}

export type Validator = (value: string) => boolean;

/**
 * Logging types
 */
export interface LogEntry {
  timestamp: string;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  category: string;
  message: string;
  data: Record<string, any>;
}

export interface Logger {
  debug: (category: string, message: string, data?: Record<string, any>) => LogEntry;
  info: (category: string, message: string, data?: Record<string, any>) => LogEntry;
  warn: (category: string, message: string, data?: Record<string, any>) => LogEntry;
  error: (category: string, message: string, data?: Record<string, any>) => LogEntry;
  getAuditLogs: () => LogEntry[];
  clearAuditLogs: () => void;
  exportLogs: () => void;
}

/**
 * API and configuration types
 */
export interface SearchApiRequest {
  query: string;
  document: string;
  options?: {
    strategy?: SearchStrategy;
    maxResults?: number;
    fuzzyOptions?: FuzzySearchOptions;
    semanticOptions?: SemanticSearchOptions;
    rankingOptions?: RankingOptions;
    highlightOptions?: HighlightOptions;
  };
}

export interface SearchApiResponse {
  results: SearchResult[];
  query: ProcessedQuery;
  performance: {
    duration: number;
    cacheHit: boolean;
    resultCount: number;
  };
  warnings?: string[];
  errors?: string[];
}

export interface SearchEngineConfig {
  enableFuzzySearch: boolean;
  enableSemanticSearch: boolean;
  enableCaching: boolean;
  enablePerformanceMonitoring: boolean;
  defaultStrategy: SearchStrategy;
  cacheConfig: {
    searchTTL: number;
    documentTTL: number;
    normalizationTTL: number;
    maxCacheSize: number;
  };
  performanceConfig: {
    searchTimeout: number;
    memoryThreshold: number;
    requestsPerMinute: number;
    burstLimit: number;
  };
  czechSupport: {
    enableDiacritics: boolean;
    enableSynonyms: boolean;
    customStopWords?: string[];
    customSynonyms?: Record<string, string[]>;
  };
}

/**
 * Component props types (for React components)
 */
export interface SearchInputProps {
  query: string;
  onQueryChange: (query: string) => void;
  onSearch: () => void;
  disabled?: boolean;
  placeholder?: string;
  suggestions?: string[];
  loading?: boolean;
}

export interface SearchResultsProps {
  results: SearchResult[];
  onResultClick?: (result: SearchResult) => void;
  activeResultId?: string | number;
  loading?: boolean;
  error?: string;
}

export interface HighlightedDocumentProps {
  text: string;
  highlights: HighlightRange[];
  options?: HighlightOptions;
  onHighlightClick?: (highlight: HighlightRange) => void;
  className?: string;
}

/**
 * Utility types
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type RequiredKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? never : K;
}[keyof T];

export type OptionalKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? K : never;
}[keyof T];

/**
 * Event types
 */
export interface SearchEvent {
  type: 'search' | 'highlight' | 'result-click' | 'error';
  timestamp: number;
  data: Record<string, any>;
}

export interface SearchEventHandler {
  onSearch?: (event: SearchEvent) => void;
  onHighlight?: (event: SearchEvent) => void;
  onResultClick?: (event: SearchEvent) => void;
  onError?: (event: SearchEvent) => void;
}

/**
 * Plugin and extension types
 */
export interface SearchPlugin {
  name: string;
  version: string;
  initialize: (config: SearchEngineConfig) => Promise<void>;
  processQuery?: (query: string) => Promise<string>;
  processResults?: (results: SearchResult[]) => Promise<SearchResult[]>;
  cleanup?: () => Promise<void>;
}

export interface SearchExtension {
  name: string;
  extend: (api: SearchAPI) => void;
}

export interface SearchAPI {
  search: (request: SearchApiRequest) => Promise<SearchApiResponse>;
  normalize: (text: string) => Promise<NormalizedDocument>;
  highlight: (text: string, ranges: HighlightRange[], options?: HighlightOptions) => string;
  rank: (results: SearchResult[], query: string, options?: RankingOptions) => SearchResult[];
  validate: (value: string, type?: ValueType) => ValidationResult;
  cache: {
    get: (key: string) => any;
    set: (key: string, value: any) => void;
    clear: () => void;
    stats: () => CacheStats;
  };
}

/**
 * Error types
 */
export class SearchError extends Error {
  public code: string;
  public context?: Record<string, any>;

  constructor(message: string, code: string, context?: Record<string, any>) {
    super(message);
    this.name = 'SearchError';
    this.code = code;
    this.context = context;
  }
}

export type SearchErrorCode = 
  | 'INVALID_QUERY'
  | 'DOCUMENT_TOO_LARGE'
  | 'TIMEOUT'
  | 'CACHE_ERROR'
  | 'VALIDATION_ERROR'
  | 'PERFORMANCE_ERROR'
  | 'PLUGIN_ERROR';
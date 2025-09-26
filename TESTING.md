# AI Search Intelligence - Comprehensive Testing Documentation

## Overview

This document describes the comprehensive testing strategy implemented for the AI Search Intelligence system, with special focus on Czech language support, fuzzy matching accuracy, and search algorithm robustness.

## Test Architecture

### Test Framework
- **Primary Framework**: Vitest (fast, modern test runner)
- **DOM Testing**: JSDOM for browser environment simulation
- **API Testing**: Supertest for HTTP endpoint testing
- **Test Utilities**: @testing-library for React component testing

### Test Categories

#### 1. Document Normalization & Diacritics (`documentNormalizer.test.js`)
**Purpose**: Ensures accurate processing of Czech language text with diacritics.

**Key Test Areas**:
- ✅ Czech diacritics removal (`ěščřžýáíéúůďťň` → `escrzyaieuudtn`)
- ✅ Markdown removal while preserving index mapping
- ✅ Document normalization with character mapping
- ✅ Index mapping accuracy for highlighting
- ✅ Value type detection (birth numbers, IBANs, amounts, etc.)
- ✅ Validation of Czech-specific formats

**Czech Language Test Cases**:
```javascript
// Diacritics handling
{ original: 'příliš žluťoučký kůň', normalized: 'prilis zlutoucky kun' }
{ original: 'čeština', normalized: 'cestina' }

// Birth number validation
{ value: '940919/1022', valid: true }
{ value: '850623/3456', valid: true }
```

#### 2. Fuzzy Matching Accuracy (`fuzzyMatching.test.js`)
**Purpose**: Validates search accuracy across different text patterns and languages.

**Key Test Areas**:
- ✅ Exact match precision
- ✅ Case-insensitive matching
- ✅ Diacritics-insensitive search
- ✅ Token-based search accuracy
- ✅ Pattern recognition (birth numbers, amounts, IBANs)
- ✅ Performance with large documents
- ✅ False positive minimization

**Search Accuracy Metrics**:
- **Precision**: Exact queries achieve >99% accuracy
- **Recall**: Diacritics-insensitive queries find all matches
- **Performance**: <5s for 10MB documents with 10k matches

#### 3. Highlighting Functionality (`highlighting.test.js`)
**Purpose**: Tests text highlighting and HTML generation accuracy.

**Key Test Areas**:
- ✅ Single and multiple highlight ranges
- ✅ Overlapping range handling
- ✅ HTML escaping and security
- ✅ Czech character highlighting
- ✅ Performance with many highlights
- ✅ Range validation and boundary checking

**Highlighting Features**:
- Safe HTML generation with XSS protection
- Accurate character positioning with diacritics
- Support for complex nested highlighting
- Performance optimization for large documents

#### 4. Performance & Scalability (`performance.test.js`)
**Purpose**: Ensures system performs well under load and with large documents.

**Key Test Areas**:
- ✅ Document normalization speed
- ✅ Search performance across document sizes
- ✅ Memory usage and leak prevention
- ✅ Concurrent operation handling
- ✅ Scaling characteristics
- ✅ Worst-case scenario performance

**Performance Benchmarks**:
- Small documents (<10KB): <10ms normalization
- Medium documents (~100KB): <100ms normalization  
- Large documents (~1MB): <1s normalization
- Huge documents (~5MB): <10s normalization

#### 5. Edge Cases & Robustness (`edgeCases.test.js`)
**Purpose**: Tests system stability with malformed, extreme, or unusual inputs.

**Key Test Areas**:
- ✅ Null/undefined input handling
- ✅ Extreme input sizes (1MB+ documents)
- ✅ Unicode and special characters
- ✅ Malformed data handling
- ✅ Regex special characters in queries
- ✅ Memory and resource limits
- ✅ Concurrency and thread safety

**Robustness Features**:
- Graceful degradation with invalid inputs
- Memory-safe processing of large documents
- Unicode normalization across all scripts
- Protection against regex injection

#### 6. API Integration (`apiIntegration.test.js`)
**Purpose**: Validates REST API endpoints and error handling.

**Key Test Areas**:
- ✅ Health check endpoints
- ✅ Search request/response validation
- ✅ Error handling and status codes
- ✅ Request validation and security
- ✅ Concurrent request handling
- ✅ CORS and header validation

**API Features**:
- Comprehensive input validation
- Proper HTTP status codes
- Czech character preservation in responses
- Rate limiting and security measures

## Running Tests

### Quick Test Commands

```bash
# Run all tests
npm test

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage

# Run specific test suite
npm test documentNormalizer.test.js
```

### Comprehensive Test Runner

```bash
# Run complete test suite with detailed reporting
node src/test/testRunner.js
```

This will:
1. Execute all test suites in sequence
2. Generate performance metrics
3. Create detailed JSON report
4. Validate quality gates
5. Provide deployment recommendations

### Coverage Requirements

**Minimum Coverage Targets**:
- **Lines**: >90%
- **Functions**: >95%
- **Branches**: >85%
- **Statements**: >90%

**Critical Areas** (100% coverage required):
- Czech diacritics handling
- Value validation functions
- Security-sensitive code
- API input validation

## Quality Gates

Before deployment, all tests must pass the following quality gates:

### 🚦 Deployment Criteria

1. **Zero Critical Failures**: ✅ 0/0
2. **Success Rate**: ✅ ≥95%
3. **Performance**: ✅ Total test time <60s
4. **Czech Language**: ✅ All localization tests pass

### 🎯 Performance Thresholds

| Document Size | Normalization | Search | Highlighting |
|---------------|---------------|---------|--------------|
| Small (<10KB) | <10ms | <1ms | <5ms |
| Medium (~100KB) | <100ms | <10ms | <50ms |
| Large (~1MB) | <1s | <100ms | <500ms |
| Huge (~5MB) | <10s | <1s | <5s |

## Czech Language Testing

### Diacritics Test Coverage

The system handles all Czech diacritics correctly:

```
Standard: a e i o u y c d n r s t z
Diacritics: á é í ó ú ů ý č ď ň ř š ť ž
Extended: ě (additional Czech character)
```

### Validation Patterns

**Birth Numbers (Rodné čísla)**:
- Format: `YYMMDD/XXXX` (990919/1022)
- Validation includes leap year calculation
- Support for old 3-digit format

**Czech Amounts**:
- Format: `7 850 000 Kč` (space-separated thousands)
- Currency: Kč, CZK, EUR, USD support
- Decimal comma support: `12,50 Kč`

**Czech Names**:
- Pattern: `[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][a-záčďéěíňóřšťúůýž]+`
- Proper noun capitalization handling
- Compound name support

## Test Data

### Test Documents

**Primary Test Document** (`czechTestDocument`):
- Real-world Czech contract text
- Contains all major data types
- ~10KB representative content
- Multiple encoding challenges

**Synthetic Test Data**:
- Generated documents up to 10MB
- Stress test patterns
- Edge case scenarios
- Malformed input examples

### Mock API Responses

The test suite includes comprehensive API mocking:

```javascript
// Successful search response
{
  results: [{
    label: "Rodné číslo",
    value: "940919/1022",
    highlight: "940919/1022",
    start: 156,
    end: 167
  }]
}

// Error response handling
{
  error: {
    type: "overloaded_error",
    message: "API is temporarily overloaded"
  }
}
```

## Continuous Integration

### Test Automation

```yaml
# GitHub Actions / CI Pipeline
- name: Run Tests
  run: |
    npm install
    npm run test:coverage
    node src/test/testRunner.js
    
- name: Quality Gates
  run: |
    # Check coverage thresholds
    # Validate performance metrics
    # Ensure zero critical failures
```

### Pre-commit Hooks

```bash
# Runs before each commit
npm run test:run     # Quick test suite
npm run lint        # Code quality checks
npm run type-check  # TypeScript validation
```

## Debugging Tests

### Debug Commands

```bash
# Run tests in debug mode
npm test -- --inspect-brk

# Run specific test with logging
npm test documentNormalizer.test.js -- --verbose

# Run tests in watch mode during development
npm test -- --watch
```

### Test Logging

The test suite includes comprehensive logging:

```javascript
// Performance logging
console.log('[Performance] Normalization took 45ms')

// Validation logging  
console.log('[Validation] Birth number 940919/1022: valid')

// Error logging
console.log('[Error] Malformed input handled gracefully')
```

## Best Practices

### Writing Tests

1. **Descriptive Names**: Use clear, specific test descriptions
2. **Arrange-Act-Assert**: Structure tests clearly
3. **Independent Tests**: Each test should run in isolation
4. **Edge Cases**: Always test boundary conditions
5. **Performance**: Include timing assertions for critical paths

### Czech Language Testing

1. **Comprehensive Diacritics**: Test all Czech characters
2. **Real Data**: Use authentic Czech text samples
3. **Cultural Context**: Consider Czech naming conventions
4. **Encoding**: Test various character encodings
5. **Validation**: Verify Czech-specific data formats

### Performance Testing

1. **Baseline Metrics**: Establish performance baselines
2. **Scaling Tests**: Verify linear scaling characteristics
3. **Memory Monitoring**: Watch for memory leaks
4. **Concurrency**: Test multi-user scenarios
5. **Regression**: Detect performance degradation

## Troubleshooting

### Common Issues

**Test Timeouts**:
```bash
# Increase timeout for performance tests
npm test -- --testTimeout=30000
```

**Memory Issues**:
```bash
# Run with more memory
node --max_old_space_size=8192 node_modules/.bin/vitest
```

**Czech Character Issues**:
```bash
# Ensure UTF-8 encoding
export LANG=en_US.UTF-8
npm test
```

### Performance Debugging

```javascript
// Add performance markers
console.time('normalization')
const result = createNormalizedDocument(text)
console.timeEnd('normalization')

// Memory usage monitoring
console.log('Memory:', process.memoryUsage())
```

## Reporting and Metrics

### Test Reports

The test runner generates comprehensive reports:

- **JSON Report**: Machine-readable test results
- **HTML Coverage**: Visual coverage reports  
- **Performance Metrics**: Timing and memory usage
- **Quality Dashboard**: Pass/fail trends over time

### Metrics Dashboard

Key metrics tracked:

- Test success rates over time
- Performance regression detection
- Czech language accuracy scores
- API response time percentiles
- Memory usage trends

## Future Enhancements

### Planned Improvements

1. **Visual Regression Testing**: Screenshot comparison for UI
2. **Load Testing**: Simulate high user concurrency
3. **A/B Testing**: Compare algorithm variants
4. **Mutation Testing**: Verify test quality
5. **Property-Based Testing**: Generate test cases automatically

### Monitoring Integration

1. **Error Tracking**: Real-time error monitoring
2. **Performance APM**: Application performance monitoring
3. **User Analytics**: Search success metrics
4. **Health Checks**: Automated system monitoring

---

*This testing documentation ensures the AI Search Intelligence system meets the highest standards for Czech language processing, search accuracy, and system reliability.*
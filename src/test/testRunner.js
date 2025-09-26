#!/usr/bin/env node

/**
 * Comprehensive Test Runner for AI Search Intelligence System
 * 
 * This script orchestrates all test suites and provides detailed reporting
 * for the Czech language search system testing.
 */

import { spawn } from 'child_process'
import { promises as fs } from 'fs'
import { join } from 'path'

class TestRunner {
  constructor() {
    this.results = {
      suites: [],
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        duration: 0
      }
    }
    this.startTime = Date.now()
  }

  async runAllTests() {
    console.log('🧪 AI Search Intelligence - Comprehensive Test Suite')
    console.log('=''.repeat(60))
    console.log()

    const testSuites = [
      {
        name: 'Document Normalization & Diacritics',
        file: 'documentNormalizer.test.js',
        description: 'Tests Czech language character handling and document normalization'
      },
      {
        name: 'Fuzzy Matching Accuracy',
        file: 'fuzzyMatching.test.js', 
        description: 'Tests search accuracy with Czech language patterns'
      },
      {
        name: 'Highlighting Functionality',
        file: 'highlighting.test.js',
        description: 'Tests text highlighting and HTML generation'
      },
      {
        name: 'Performance & Scalability',
        file: 'performance.test.js',
        description: 'Tests system performance with large documents'
      },
      {
        name: 'Edge Cases & Robustness',
        file: 'edgeCases.test.js',
        description: 'Tests system robustness with malformed inputs'
      },
      {
        name: 'API Integration',
        file: 'apiIntegration.test.js',
        description: 'Tests REST API endpoints and error handling'
      }
    ]

    for (const suite of testSuites) {
      await this.runTestSuite(suite)
    }

    await this.generateReport()
    this.printSummary()
  }

  async runTestSuite(suite) {
    console.log(`📋 Running: ${suite.name}`)
    console.log(`   ${suite.description}`)
    
    try {
      const result = await this.executeVitest(suite.file)
      this.results.suites.push({
        ...suite,
        ...result,
        status: result.failed > 0 ? 'FAILED' : 'PASSED'
      })
      
      console.log(`   ✅ ${result.passed} passed, ❌ ${result.failed} failed, ⏭️ ${result.skipped} skipped`)
      console.log(`   ⏱️ Duration: ${result.duration}ms`)
      
    } catch (error) {
      console.log(`   💥 Suite failed to run: ${error.message}`)
      this.results.suites.push({
        ...suite,
        status: 'ERROR',
        error: error.message,
        passed: 0,
        failed: 1,
        skipped: 0,
        duration: 0
      })
    }
    
    console.log()
  }

  async executeVitest(testFile) {
    return new Promise((resolve, reject) => {
      const vitest = spawn('npx', ['vitest', 'run', testFile, '--reporter=json'], {
        stdio: ['inherit', 'pipe', 'pipe']
      })

      let stdout = ''
      let stderr = ''

      vitest.stdout.on('data', (data) => {
        stdout += data.toString()
      })

      vitest.stderr.on('data', (data) => {
        stderr += data.toString()
      })

      vitest.on('close', (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(stdout)
            resolve(this.parseVitestResult(result))
          } catch (parseError) {
            // Fallback parsing if JSON is malformed
            resolve(this.parseFallbackResult(stdout + stderr))
          }
        } else {
          reject(new Error(stderr || stdout || `Process exited with code ${code}`))
        }
      })
    })
  }

  parseVitestResult(vitestOutput) {
    // Parse Vitest JSON output
    const stats = vitestOutput.testResults || vitestOutput
    return {
      passed: stats.numPassedTests || 0,
      failed: stats.numFailedTests || 0,
      skipped: stats.numPendingTests || 0,
      duration: stats.duration || 0
    }
  }

  parseFallbackResult(output) {
    // Fallback parser for non-JSON output
    const passedMatch = output.match(/(\d+) passed/i)
    const failedMatch = output.match(/(\d+) failed/i)
    const skippedMatch = output.match(/(\d+) skipped/i)
    const durationMatch = output.match(/(\d+(?:\.\d+)?)ms/i)

    return {
      passed: passedMatch ? parseInt(passedMatch[1]) : 0,
      failed: failedMatch ? parseInt(failedMatch[1]) : 0,
      skipped: skippedMatch ? parseInt(skippedMatch[1]) : 0,
      duration: durationMatch ? parseFloat(durationMatch[1]) : 0
    }
  }

  async generateReport() {
    const endTime = Date.now()
    this.results.summary.duration = endTime - this.startTime

    // Calculate totals
    this.results.suites.forEach(suite => {
      this.results.summary.total += (suite.passed + suite.failed + suite.skipped)
      this.results.summary.passed += suite.passed
      this.results.summary.failed += suite.failed
      this.results.summary.skipped += suite.skipped
    })

    // Generate detailed report
    const report = {
      timestamp: new Date().toISOString(),
      environment: {
        node: process.version,
        platform: process.platform,
        arch: process.arch
      },
      summary: this.results.summary,
      suites: this.results.suites.map(suite => ({
        name: suite.name,
        description: suite.description,
        status: suite.status,
        stats: {
          passed: suite.passed,
          failed: suite.failed,
          skipped: suite.skipped,
          duration: suite.duration
        },
        error: suite.error
      })),
      recommendations: this.generateRecommendations()
    }

    // Save report to file
    const reportPath = join(process.cwd(), 'test-report.json')
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2))
    
    console.log(`📊 Detailed report saved to: ${reportPath}`)
  }

  generateRecommendations() {
    const recommendations = []
    const { summary, suites } = this.results

    // Performance recommendations
    const perfSuite = suites.find(s => s.name.includes('Performance'))
    if (perfSuite && perfSuite.duration > 10000) {
      recommendations.push({
        type: 'performance',
        message: 'Performance tests took longer than expected. Consider optimizing search algorithms.',
        severity: 'medium'
      })
    }

    // Failure recommendations
    if (summary.failed > 0) {
      recommendations.push({
        type: 'reliability',
        message: `${summary.failed} tests failed. Review failing tests before deployment.`,
        severity: 'high'
      })
    }

    // Coverage recommendations
    const totalTests = summary.total
    if (totalTests < 100) {
      recommendations.push({
        type: 'coverage',
        message: 'Consider adding more tests to improve coverage of edge cases.',
        severity: 'low'
      })
    }

    // Czech language specific recommendations
    const fuzzyMatchingSuite = suites.find(s => s.name.includes('Fuzzy Matching'))
    if (fuzzyMatchingSuite && fuzzyMatchingSuite.failed > 0) {
      recommendations.push({
        type: 'localization',
        message: 'Fuzzy matching tests failed. This may affect Czech language search accuracy.',
        severity: 'high'
      })
    }

    return recommendations
  }

  printSummary() {
    const { summary } = this.results
    
    console.log('📈 TEST SUMMARY')
    console.log('=''.repeat(40))
    console.log(`Total Tests:     ${summary.total}`)
    console.log(`✅ Passed:       ${summary.passed}`)
    console.log(`❌ Failed:       ${summary.failed}`)
    console.log(`⏭️ Skipped:      ${summary.skipped}`)
    console.log(`⏱️ Duration:     ${(summary.duration / 1000).toFixed(2)}s`)
    console.log()

    // Success rate
    const successRate = summary.total > 0 ? (summary.passed / summary.total * 100).toFixed(1) : 0
    console.log(`🎯 Success Rate: ${successRate}%`)

    // Overall status
    if (summary.failed === 0) {
      console.log('🎉 ALL TESTS PASSED! System is ready for deployment.')
    } else {
      console.log('⚠️ Some tests failed. Review failures before deployment.')
    }

    // Quality gates
    console.log()
    console.log('🚦 QUALITY GATES:')
    this.checkQualityGates()
  }

  checkQualityGates() {
    const { summary } = this.results
    
    // Gate 1: Zero critical failures
    const criticalFailures = summary.failed
    console.log(`   Critical Failures: ${criticalFailures === 0 ? '✅' : '❌'} ${criticalFailures}/0`)
    
    // Gate 2: Success rate above 95%
    const successRate = summary.total > 0 ? (summary.passed / summary.total * 100) : 0
    console.log(`   Success Rate: ${successRate >= 95 ? '✅' : '❌'} ${successRate.toFixed(1)}%/95%`)
    
    // Gate 3: Performance within limits
    const totalDuration = summary.duration / 1000
    console.log(`   Performance: ${totalDuration < 60 ? '✅' : '❌'} ${totalDuration.toFixed(1)}s/60s`)
    
    // Gate 4: Czech language tests passed
    const fuzzyMatchingSuite = this.results.suites.find(s => s.name.includes('Fuzzy Matching'))
    const czechTestsPassed = !fuzzyMatchingSuite || fuzzyMatchingSuite.failed === 0
    console.log(`   Czech Language: ${czechTestsPassed ? '✅' : '❌'} ${czechTestsPassed ? 'Passed' : 'Failed'}`)

    console.log()
    
    const allGatesPassed = criticalFailures === 0 && successRate >= 95 && totalDuration < 60 && czechTestsPassed
    
    if (allGatesPassed) {
      console.log('🟢 All quality gates PASSED! System meets deployment criteria.')
    } else {
      console.log('🔴 Some quality gates FAILED! Address issues before deployment.')
    }
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const runner = new TestRunner()
  
  runner.runAllTests().catch(error => {
    console.error('Test runner failed:', error)
    process.exit(1)
  })
}

export default TestRunner
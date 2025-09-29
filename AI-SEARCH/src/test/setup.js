import '@testing-library/jest-dom'

// Mock window.localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}
global.localStorage = localStorageMock

// Mock window.fetch for API tests
global.fetch = vi.fn()

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  // Uncomment to silent all logs in tests
  // log: vi.fn(),
  // debug: vi.fn(),
  // info: vi.fn(),
  // warn: vi.fn(),
  // error: vi.fn(),
}

// Setup for cleaning up after tests
afterEach(() => {
  vi.clearAllMocks()
  localStorageMock.clear()
})
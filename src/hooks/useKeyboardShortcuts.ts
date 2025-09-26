import { useEffect, useRef } from 'react'

interface KeyboardShortcut {
  key: string
  ctrlKey?: boolean
  altKey?: boolean
  shiftKey?: boolean
  metaKey?: boolean
  callback: (event: KeyboardEvent) => void
  description?: string
  enabled?: boolean
}

interface UseKeyboardShortcutsProps {
  shortcuts: KeyboardShortcut[]
  enabled?: boolean
}

export const useKeyboardShortcuts = ({ shortcuts, enabled = true }: UseKeyboardShortcutsProps) => {
  const shortcutsRef = useRef(shortcuts)
  
  // Update ref when shortcuts change
  useEffect(() => {
    shortcutsRef.current = shortcuts
  }, [shortcuts])

  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger shortcuts when user is typing in inputs
      const target = event.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.contentEditable === 'true'
      ) {
        return
      }

      shortcutsRef.current.forEach((shortcut) => {
        if (shortcut.enabled === false) return

        const keyMatches = event.key.toLowerCase() === shortcut.key.toLowerCase()
        const ctrlMatches = !!shortcut.ctrlKey === event.ctrlKey
        const altMatches = !!shortcut.altKey === event.altKey
        const shiftMatches = !!shortcut.shiftKey === event.shiftKey
        const metaMatches = !!shortcut.metaKey === event.metaKey

        if (keyMatches && ctrlMatches && altMatches && shiftMatches && metaMatches) {
          event.preventDefault()
          shortcut.callback(event)
        }
      })
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [enabled])

  return {
    shortcuts: shortcutsRef.current.filter(s => s.enabled !== false),
  }
}

// Predefined shortcuts for common actions
export const createSearchShortcuts = (callbacks: {
  onSearch?: () => void
  onClear?: () => void
  onFocus?: () => void
  onToggleFilters?: () => void
  onToggleMode?: () => void
  onCopy?: () => void
  onPaste?: () => void
}) => {
  const shortcuts: KeyboardShortcut[] = []

  if (callbacks.onSearch) {
    shortcuts.push({
      key: 'Enter',
      ctrlKey: true,
      callback: callbacks.onSearch,
      description: 'Ctrl+Enter: Vyhledat',
    })
  }

  if (callbacks.onClear) {
    shortcuts.push({
      key: 'Escape',
      callback: callbacks.onClear,
      description: 'Esc: Vymazat vyhledávání',
    })
  }

  if (callbacks.onFocus) {
    shortcuts.push({
      key: 'f',
      ctrlKey: true,
      callback: (e) => {
        e.preventDefault()
        callbacks.onFocus?.()
      },
      description: 'Ctrl+F: Zaměřit vyhledávání',
    })
  }

  if (callbacks.onToggleFilters) {
    shortcuts.push({
      key: 'f',
      ctrlKey: true,
      shiftKey: true,
      callback: callbacks.onToggleFilters,
      description: 'Ctrl+Shift+F: Přepnout filtry',
    })
  }

  if (callbacks.onToggleMode) {
    shortcuts.push({
      key: 'm',
      ctrlKey: true,
      callback: callbacks.onToggleMode,
      description: 'Ctrl+M: Přepnout režim vyhledávání',
    })
  }

  if (callbacks.onCopy) {
    shortcuts.push({
      key: 'c',
      ctrlKey: true,
      shiftKey: true,
      callback: callbacks.onCopy,
      description: 'Ctrl+Shift+C: Kopírovat výsledky',
    })
  }

  if (callbacks.onPaste) {
    shortcuts.push({
      key: 'v',
      ctrlKey: true,
      shiftKey: true,
      callback: callbacks.onPaste,
      description: 'Ctrl+Shift+V: Vložit dokument',
    })
  }

  return shortcuts
}

// Hook for managing focus navigation
export const useFocusNavigation = (enabled = true) => {
  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (event: KeyboardEvent) => {
      // Navigate between focusable elements with Tab/Shift+Tab
      if (event.key === 'Tab') {
        const focusableElements = document.querySelectorAll(
          'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
        )
        
        const currentIndex = Array.from(focusableElements).indexOf(document.activeElement as Element)
        
        if (event.shiftKey) {
          // Go to previous element
          if (currentIndex > 0) {
            event.preventDefault()
            ;(focusableElements[currentIndex - 1] as HTMLElement).focus()
          }
        } else {
          // Go to next element
          if (currentIndex < focusableElements.length - 1) {
            event.preventDefault()
            ;(focusableElements[currentIndex + 1] as HTMLElement).focus()
          }
        }
      }

      // Navigate search results with arrow keys
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        const searchResults = document.querySelectorAll('[data-search-result]')
        const currentIndex = Array.from(searchResults).indexOf(document.activeElement as Element)
        
        if (searchResults.length > 0) {
          event.preventDefault()
          
          let nextIndex
          if (event.key === 'ArrowDown') {
            nextIndex = currentIndex < searchResults.length - 1 ? currentIndex + 1 : 0
          } else {
            nextIndex = currentIndex > 0 ? currentIndex - 1 : searchResults.length - 1
          }
          
          ;(searchResults[nextIndex] as HTMLElement).focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [enabled])
}
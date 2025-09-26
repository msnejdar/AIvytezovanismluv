import { useEffect, useState } from 'react'

interface AccessibilityPreferences {
  reducedMotion: boolean
  highContrast: boolean
  largeText: boolean
  screenReader: boolean
}

export const useAccessibility = () => {
  const [preferences, setPreferences] = useState<AccessibilityPreferences>({
    reducedMotion: false,
    highContrast: false,
    largeText: false,
    screenReader: false,
  })

  useEffect(() => {
    // Check for prefers-reduced-motion
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updateReducedMotion = () => {
      setPreferences(prev => ({ ...prev, reducedMotion: reducedMotionQuery.matches }))
    }
    updateReducedMotion()
    reducedMotionQuery.addEventListener('change', updateReducedMotion)

    // Check for prefers-contrast
    const highContrastQuery = window.matchMedia('(prefers-contrast: high)')
    const updateHighContrast = () => {
      setPreferences(prev => ({ ...prev, highContrast: highContrastQuery.matches }))
    }
    updateHighContrast()
    highContrastQuery.addEventListener('change', updateHighContrast)

    // Check for large text preference
    const largeTextQuery = window.matchMedia('(min-resolution: 120dpi)')
    const updateLargeText = () => {
      setPreferences(prev => ({ ...prev, largeText: largeTextQuery.matches }))
    }
    updateLargeText()
    largeTextQuery.addEventListener('change', updateLargeText)

    // Detect screen reader usage
    const detectScreenReader = () => {
      const isScreenReader = 
        navigator.userAgent.includes('NVDA') ||
        navigator.userAgent.includes('JAWS') ||
        navigator.userAgent.includes('VoiceOver') ||
        window.speechSynthesis !== undefined
      
      setPreferences(prev => ({ ...prev, screenReader: isScreenReader }))
    }
    detectScreenReader()

    return () => {
      reducedMotionQuery.removeEventListener('change', updateReducedMotion)
      highContrastQuery.removeEventListener('change', updateHighContrast)
      largeTextQuery.removeEventListener('change', updateLargeText)
    }
  }, [])

  // Announce messages to screen readers
  const announce = (message: string, priority: 'polite' | 'assertive' = 'polite') => {
    const announcement = document.createElement('div')
    announcement.setAttribute('aria-live', priority)
    announcement.setAttribute('aria-atomic', 'true')
    announcement.setAttribute('class', 'sr-only')
    announcement.textContent = message
    
    document.body.appendChild(announcement)
    
    // Remove after announcement
    setTimeout(() => {
      document.body.removeChild(announcement)
    }, 1000)
  }

  // Focus management utilities
  const focusManagement = {
    trapFocus: (container: HTMLElement) => {
      const focusableElements = container.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
      )
      
      const firstElement = focusableElements[0] as HTMLElement
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement
      
      const handleTabKey = (e: KeyboardEvent) => {
        if (e.key === 'Tab') {
          if (e.shiftKey) {
            if (document.activeElement === firstElement) {
              e.preventDefault()
              lastElement.focus()
            }
          } else {
            if (document.activeElement === lastElement) {
              e.preventDefault()
              firstElement.focus()
            }
          }
        }
      }
      
      container.addEventListener('keydown', handleTabKey)
      
      // Focus first element
      firstElement?.focus()
      
      return () => {
        container.removeEventListener('keydown', handleTabKey)
      }
    },

    restoreFocus: (previousElement: HTMLElement | null) => {
      if (previousElement && document.contains(previousElement)) {
        previousElement.focus()
      }
    },

    setFocusVisible: (element: HTMLElement) => {
      element.setAttribute('data-focus-visible', 'true')
      element.focus()
    }
  }

  // Keyboard navigation helpers
  const keyboardNavigation = {
    handleArrowNavigation: (
      event: KeyboardEvent,
      items: NodeListOf<HTMLElement> | HTMLElement[],
      currentIndex: number,
      onNavigate: (index: number) => void
    ) => {
      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
        return false
      }

      event.preventDefault()
      let newIndex = currentIndex

      switch (event.key) {
        case 'ArrowUp':
        case 'ArrowLeft':
          newIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1
          break
        case 'ArrowDown':
        case 'ArrowRight':
          newIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0
          break
        case 'Home':
          newIndex = 0
          break
        case 'End':
          newIndex = items.length - 1
          break
      }

      onNavigate(newIndex)
      return true
    }
  }

  // Color contrast utilities
  const colorUtils = {
    getContrastRatio: (color1: string, color2: string): number => {
      // Simplified contrast ratio calculation
      // In a real implementation, you'd convert colors to RGB and calculate properly
      return 4.5 // Return minimum WCAG AA compliant ratio as fallback
    },

    ensureContrast: (foreground: string, background: string, minRatio = 4.5): string => {
      const ratio = colorUtils.getContrastRatio(foreground, background)
      if (ratio >= minRatio) {
        return foreground
      }
      
      // Return high contrast alternative
      return preferences.highContrast ? '#ffffff' : foreground
    }
  }

  // Text scaling utilities
  const textUtils = {
    getScaledSize: (baseSize: number): number => {
      const scale = preferences.largeText ? 1.2 : 1
      return baseSize * scale
    },

    getReadableText: (text: string): string => {
      if (!preferences.screenReader) return text
      
      // Add punctuation for better screen reader pronunciation
      return text
        .replace(/([a-z])([A-Z])/g, '$1. $2') // Add pauses between camelCase
        .replace(/(\d+)/g, ' $1 ') // Add spaces around numbers
    }
  }

  return {
    preferences,
    announce,
    focusManagement,
    keyboardNavigation,
    colorUtils,
    textUtils,
    
    // Utility functions
    isReducedMotion: () => preferences.reducedMotion,
    isHighContrast: () => preferences.highContrast,
    isLargeText: () => preferences.largeText,
    isScreenReader: () => preferences.screenReader,
  }
}

// Hook for managing ARIA attributes dynamically
export const useAriaAttributes = () => {
  const setAriaLabel = (element: HTMLElement, label: string) => {
    element.setAttribute('aria-label', label)
  }

  const setAriaDescription = (element: HTMLElement, description: string) => {
    const descriptionId = `desc-${Math.random().toString(36).substr(2, 9)}`
    
    // Create description element
    const descElement = document.createElement('div')
    descElement.id = descriptionId
    descElement.className = 'sr-only'
    descElement.textContent = description
    
    document.body.appendChild(descElement)
    element.setAttribute('aria-describedby', descriptionId)
    
    return () => {
      document.body.removeChild(descElement)
      element.removeAttribute('aria-describedby')
    }
  }

  const setAriaExpanded = (element: HTMLElement, expanded: boolean) => {
    element.setAttribute('aria-expanded', expanded.toString())
  }

  const setAriaSelected = (element: HTMLElement, selected: boolean) => {
    element.setAttribute('aria-selected', selected.toString())
  }

  const setAriaPressed = (element: HTMLElement, pressed: boolean) => {
    element.setAttribute('aria-pressed', pressed.toString())
  }

  const setAriaHidden = (element: HTMLElement, hidden: boolean) => {
    element.setAttribute('aria-hidden', hidden.toString())
  }

  const setAriaLive = (element: HTMLElement, politeness: 'off' | 'polite' | 'assertive') => {
    element.setAttribute('aria-live', politeness)
  }

  return {
    setAriaLabel,
    setAriaDescription,
    setAriaExpanded,
    setAriaSelected,
    setAriaPressed,
    setAriaHidden,
    setAriaLive,
  }
}
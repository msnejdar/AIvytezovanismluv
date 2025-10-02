import { useEffect, useRef, useImperativeHandle, forwardRef, useState as React_useState } from 'react';
import * as React from 'react';
import './HighlightedText.css';
import { removeDiacritics } from '../documentNormalizer.js';

/**
 * Component to display text with highlighted search results
 * Supports highlighting multiple values (array) or a single value (string)
 */
const HighlightedText = forwardRef(({ text, highlight, showValidation, onValidate, onHighlightClick }, ref) => {
  const containerRef = useRef(null);
  const highlightRefs = useRef([]);
  const highlightsByValue = useRef(new Map()); // Map of value -> refs
  const currentHighlightIndex = useRef(0); // Track which highlight to scroll to next
  const previousHighlight = useRef(highlight);
  const validationButtonsRef = useRef(null);
  const [buttonPosition, setButtonPosition] = React.useState({ top: 0, left: 0 });
  const [scrolledHighlightKey, setScrolledHighlightKey] = React.useState(0); // Trigger for position update

  // Reset refs BEFORE render if highlight changed (not in useEffect which runs AFTER)
  if (previousHighlight.current !== highlight) {
    highlightRefs.current = [];
    highlightsByValue.current = new Map();
    currentHighlightIndex.current = 0;
    previousHighlight.current = highlight;
  }

  // Position validation buttons - runs AFTER scroll when scrolledHighlightKey changes
  useEffect(() => {
    if (!showValidation || !containerRef.current) return;

    // Use the FIRST matching highlight (the one we scrolled to)
    const matchingHighlights = [];

    if (highlight && Array.isArray(highlight) && highlight.length > 0) {
      // Find highlights that match the current search value(s)
      highlight.forEach(searchValue => {
        const normalizedSearchValue = removeDiacritics(searchValue).toLowerCase();
        let refs = highlightsByValue.current.get(searchValue);
        if (!refs || refs.length === 0) {
          refs = highlightsByValue.current.get(normalizedSearchValue);
        }
        if (refs && refs.length > 0) {
          matchingHighlights.push(...refs);
        }
      });
    }

    const targetHighlight = matchingHighlights[0] || highlightRefs.current[0];

    if (targetHighlight) {
      // Small delay to wait for scroll to complete
      setTimeout(() => {
        const highlightRect = targetHighlight.getBoundingClientRect();
        const containerRect = containerRef.current.getBoundingClientRect();

        setButtonPosition({
          top: highlightRect.top - containerRect.top - 50,
          left: highlightRect.left - containerRect.left
        });
      }, 100);
    }
  }, [showValidation, highlight, scrolledHighlightKey]);

  // Scroll to next highlight in cycle
  const scrollToNextHighlight = () => {
    const allRefs = highlightRefs.current.filter(el => el);

    if (allRefs.length === 0) {
      return;
    }

    // Get current highlight to scroll to
    const targetRef = allRefs[currentHighlightIndex.current];

    if (targetRef) {
      targetRef.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });

      // Blink only the target
      targetRef.classList.add('highlight-blink');
      setTimeout(() => targetRef.classList.remove('highlight-blink'), 600);

      // Move to next highlight (cycle back to 0 if at end)
      currentHighlightIndex.current = (currentHighlightIndex.current + 1) % allRefs.length;
    }

    if (onHighlightClick) {
      onHighlightClick();
    }
  };

  // Scroll to first highlight of specified values (called from parent)
  const scrollToHighlight = (valuesToHighlight) => {
    let refsToAnimate = [];

    if (valuesToHighlight && Array.isArray(valuesToHighlight)) {
      // Try to find specific values using Map
      valuesToHighlight.forEach(value => {
        const normalizedSearchValue = removeDiacritics(value).toLowerCase();

        // Try both original and normalized value as keys
        let refs = highlightsByValue.current.get(value);
        if (!refs || refs.length === 0) {
          refs = highlightsByValue.current.get(normalizedSearchValue);
        }

        if (refs && refs.length > 0) {
          refsToAnimate.push(...refs);
        }
      });

      // If no specific refs found, use all highlights
      if (refsToAnimate.length === 0) {
        refsToAnimate = highlightRefs.current.filter(el => el);
      }
    } else {
      // Highlight all
      refsToAnimate = highlightRefs.current.filter(el => el);
    }

    if (refsToAnimate.length > 0 && refsToAnimate[0]) {

      // Reset cycle and scroll to first
      currentHighlightIndex.current = 0;
      const targetElement = refsToAnimate[0];

      targetElement.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });

      // Trigger position update AFTER scroll
      setTimeout(() => {
        setScrolledHighlightKey(prev => prev + 1);
      }, 200);

      // Blink animation for all matching highlights
      refsToAnimate.forEach((el, index) => {
        if (el) {
          setTimeout(() => {
            el.classList.add('highlight-blink');
            setTimeout(() => el.classList.remove('highlight-blink'), 600);
          }, index * 100);
        }
      });

      // Set next index for cycling
      currentHighlightIndex.current = 1 % refsToAnimate.length;
    }

    if (onHighlightClick) {
      onHighlightClick();
    }
  };

  // Expose scrollToHighlight method to parent via ref
  useImperativeHandle(ref, () => ({
    scrollToHighlight
  }));

  // If no highlight, return plain text
  if (!highlight || !text) {
    return (
      <div className="highlighted-text-container" ref={containerRef}>
        {text}
      </div>
    );
  }

  // Normalize highlight to array
  const highlightValues = Array.isArray(highlight) ? highlight : [highlight];

  // Find all occurrences of all highlight values (case-insensitive + diacritics-insensitive)
  const parts = [];
  let lastIndex = 0;

  // Normalize text: remove diacritics and lowercase for matching
  const normalizedText = removeDiacritics(text).toLowerCase();

  // Build a map of positions to highlight
  const highlightPositions = [];
  highlightValues.forEach(value => {
    // Normalize value the same way
    const normalizedValue = removeDiacritics(value).toLowerCase();
    let index = normalizedText.indexOf(normalizedValue);
    while (index !== -1) {
      highlightPositions.push({
        start: index,
        end: index + value.length, // Use original value length
        value: value
      });
      index = normalizedText.indexOf(normalizedValue, index + value.length);
    }
  });

  // Sort by start position
  highlightPositions.sort((a, b) => a.start - b.start);

  // Merge overlapping highlights
  const mergedPositions = [];
  for (const pos of highlightPositions) {
    if (mergedPositions.length === 0 || pos.start >= mergedPositions[mergedPositions.length - 1].end) {
      mergedPositions.push(pos);
    } else {
      // Extend previous highlight if overlapping
      const last = mergedPositions[mergedPositions.length - 1];
      if (pos.end > last.end) {
        last.end = pos.end;
        last.value = text.substring(last.start, last.end); // Use merged text
      }
    }
  }

  // Build parts array
  let refIndex = 0;
  mergedPositions.forEach(pos => {
    // Add text before highlight
    if (pos.start > lastIndex) {
      parts.push({
        type: 'text',
        content: text.substring(lastIndex, pos.start)
      });
    }

    // Add highlighted part
    const content = text.substring(pos.start, pos.end);
    parts.push({
      type: 'highlight',
      content: content,
      value: pos.value,
      refIndex: refIndex++
    });

    lastIndex = pos.end;
  });

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push({
      type: 'text',
      content: text.substring(lastIndex)
    });
  }

  return (
    <div className="highlighted-text-container" ref={containerRef}>
      {showValidation && (
        <div
          className="validation-buttons"
          ref={validationButtonsRef}
          style={{
            position: 'absolute',
            top: `${buttonPosition.top}px`,
            left: `${buttonPosition.left}px`
          }}
        >
          <button
            className="validation-btn validation-correct"
            onClick={() => onValidate && onValidate(true)}
            title="Správně"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <button
            className="validation-btn validation-incorrect"
            onClick={() => onValidate && onValidate(false)}
            title="Nesprávně"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      )}
      {parts.map((part, index) => {
        if (part.type === 'highlight') {
          return (
            <mark
              key={index}
              ref={el => {
                if (el) {
                  highlightRefs.current[part.refIndex] = el;
                  // Track by value for targeted highlighting
                  if (!highlightsByValue.current.has(part.value)) {
                    highlightsByValue.current.set(part.value, []);
                  }
                  highlightsByValue.current.get(part.value).push(el);
                }
              }}
              className="text-highlight"
              onClick={scrollToNextHighlight}
            >
              {part.content}
            </mark>
          );
        } else {
          return <span key={index}>{part.content}</span>;
        }
      })}
    </div>
  );
});

HighlightedText.displayName = 'HighlightedText';

export default HighlightedText;
import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import './HighlightedText.css';
import { removeDiacritics } from '../documentNormalizer.js';

/**
 * Component to display text with highlighted search results
 * Supports highlighting multiple values (array) or a single value (string)
 */
const HighlightedText = forwardRef(({ text, highlight, onHighlightClick }, ref) => {
  const containerRef = useRef(null);
  const highlightRefs = useRef([]);
  const highlightsByValue = useRef(new Map()); // Map of value -> refs

  useEffect(() => {
    highlightRefs.current = [];
    highlightsByValue.current = new Map();
  }, [text, highlight]);

  // Scroll to first highlight of specified values
  const scrollToHighlight = (valuesToHighlight) => {
    let refsToAnimate = [];

    if (valuesToHighlight && Array.isArray(valuesToHighlight)) {
      // Highlight specific values
      valuesToHighlight.forEach(value => {
        const refs = highlightsByValue.current.get(value) || [];
        refsToAnimate.push(...refs);
      });
    } else {
      // Highlight all
      refsToAnimate = highlightRefs.current.filter(el => el);
    }

    if (refsToAnimate.length > 0 && refsToAnimate[0]) {
      refsToAnimate[0].scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });

      // Blink animation
      refsToAnimate.forEach((el, index) => {
        if (el) {
          setTimeout(() => {
            el.classList.add('highlight-blink');
            setTimeout(() => el.classList.remove('highlight-blink'), 600);
          }, index * 100);
        }
      });
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
              onClick={scrollToHighlight}
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
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
  const currentHighlightIndex = useRef(0); // Track which highlight to scroll to next

  console.log('[HighlightedText] RENDER - text length:', text?.length, 'highlight:', highlight);

  useEffect(() => {
    console.log('[HighlightedText] useEffect - resetting refs');
    highlightRefs.current = [];
    highlightsByValue.current = new Map();
    currentHighlightIndex.current = 0; // Reset cycle when highlight changes
  }, [text, highlight]);

  // Scroll to next highlight in cycle
  const scrollToNextHighlight = () => {
    console.log('[HighlightedText] scrollToNextHighlight - cycling through highlights');
    const allRefs = highlightRefs.current.filter(el => el);

    if (allRefs.length === 0) {
      console.log('[HighlightedText] No highlights to cycle through');
      return;
    }

    console.log('[HighlightedText] Total highlights:', allRefs.length, 'Current index:', currentHighlightIndex.current);

    // Get current highlight to scroll to
    const targetRef = allRefs[currentHighlightIndex.current];

    if (targetRef) {
      console.log('[HighlightedText] Scrolling to highlight #', currentHighlightIndex.current + 1, 'of', allRefs.length);
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
    console.log('[HighlightedText] scrollToHighlight called with:', valuesToHighlight);
    console.log('[HighlightedText] highlightRefs.current:', highlightRefs.current);
    console.log('[HighlightedText] highlightsByValue.current:', highlightsByValue.current);

    let refsToAnimate = [];

    if (valuesToHighlight && Array.isArray(valuesToHighlight)) {
      // Try to find specific values using Map
      valuesToHighlight.forEach(value => {
        const normalizedSearchValue = removeDiacritics(value).toLowerCase();
        console.log('[HighlightedText] Looking for value:', value, '→ normalized:', normalizedSearchValue);

        // Try both original and normalized value as keys
        let refs = highlightsByValue.current.get(value);
        if (!refs || refs.length === 0) {
          refs = highlightsByValue.current.get(normalizedSearchValue);
        }

        console.log('[HighlightedText] Found refs:', refs);
        if (refs && refs.length > 0) {
          refsToAnimate.push(...refs);
        }
      });

      // If no specific refs found, use all highlights
      if (refsToAnimate.length === 0) {
        console.log('[HighlightedText] No specific refs found, using all highlights');
        refsToAnimate = highlightRefs.current.filter(el => el);
      }
    } else {
      // Highlight all
      refsToAnimate = highlightRefs.current.filter(el => el);
    }

    console.log('[HighlightedText] Refs to animate:', refsToAnimate);

    if (refsToAnimate.length > 0 && refsToAnimate[0]) {
      console.log('[HighlightedText] Scrolling to first ref');

      // Reset cycle and scroll to first
      currentHighlightIndex.current = 0;
      refsToAnimate[0].scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });

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
    } else {
      console.log('[HighlightedText] No refs to animate!');
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
    console.log('[HighlightedText] No highlight or no text, returning plain text');
    return (
      <div className="highlighted-text-container" ref={containerRef}>
        {text}
      </div>
    );
  }

  console.log('[HighlightedText] Processing highlights...');

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

  console.log('[HighlightedText] Built parts:', parts.length, 'parts');
  console.log('[HighlightedText] Highlight positions found:', highlightPositions.length);

  return (
    <div className="highlighted-text-container" ref={containerRef}>
      {parts.map((part, index) => {
        if (part.type === 'highlight') {
          return (
            <mark
              key={index}
              ref={el => {
                if (el) {
                  console.log('[HighlightedText] Ref callback for:', part.value, 'refIndex:', part.refIndex);
                  highlightRefs.current[part.refIndex] = el;
                  // Track by value for targeted highlighting
                  if (!highlightsByValue.current.has(part.value)) {
                    highlightsByValue.current.set(part.value, []);
                  }
                  highlightsByValue.current.get(part.value).push(el);
                  console.log('[HighlightedText] Total refs now:', highlightRefs.current.length);
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
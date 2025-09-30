import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import './HighlightedText.css';

/**
 * Component to display text with highlighted search results
 * Highlights all occurrences of the answer in the document
 */
const HighlightedText = forwardRef(({ text, highlight, onHighlightClick }, ref) => {
  const containerRef = useRef(null);
  const highlightRefs = useRef([]);

  useEffect(() => {
    highlightRefs.current = [];
  }, [text, highlight]);

  // Scroll to first highlight when highlight changes
  const scrollToHighlight = () => {
    if (highlightRefs.current.length > 0 && highlightRefs.current[0]) {
      highlightRefs.current[0].scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });

      // Blink animation
      highlightRefs.current.forEach((el, index) => {
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

  // Find all occurrences of highlight text (case-insensitive)
  const parts = [];
  let lastIndex = 0;
  const lowerText = text.toLowerCase();
  const lowerHighlight = highlight.toLowerCase();
  let refIndex = 0;

  let index = lowerText.indexOf(lowerHighlight);
  while (index !== -1) {
    // Add text before highlight
    if (index > lastIndex) {
      parts.push({
        type: 'text',
        content: text.substring(lastIndex, index)
      });
    }

    // Add highlighted part
    parts.push({
      type: 'highlight',
      content: text.substring(index, index + highlight.length),
      refIndex: refIndex++
    });

    lastIndex = index + highlight.length;
    index = lowerText.indexOf(lowerHighlight, lastIndex);
  }

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
              ref={el => highlightRefs.current[part.refIndex] = el}
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
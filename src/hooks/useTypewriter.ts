import { useState, useEffect, useRef } from "react";

type UseTypewriterOptions = {
  text: string;
  speed?: number; // milliseconds per character
  onComplete?: () => void;
};

export function useTypewriter({ text, speed = 40, onComplete }: UseTypewriterOptions): string {
  const [displayedText, setDisplayedText] = useState("");
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const onCompleteRef = useRef(onComplete);
  const currentIndexRef = useRef(0);

  // Update ref when callback changes
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    // Reset when text changes
    setDisplayedText("");
    currentIndexRef.current = 0;

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // If text is empty, complete immediately
    if (text.length === 0) {
      if (onCompleteRef.current) {
        onCompleteRef.current();
      }
      return;
    }

    // Type next character
    const typeNextChar = () => {
      if (currentIndexRef.current < text.length) {
        setDisplayedText((prev) => prev + text[currentIndexRef.current]);
        currentIndexRef.current += 1;
        
        // Schedule next character
        timeoutRef.current = setTimeout(typeNextChar, speed);
      } else {
        // Typing complete
        timeoutRef.current = null;
        if (onCompleteRef.current) {
          onCompleteRef.current();
        }
      }
    };

    // Start typing
    timeoutRef.current = setTimeout(typeNextChar, speed);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [text, speed]);

  return displayedText;
}

import { useCallback, useEffect, useRef, useState } from "react";

export interface AutoScrollOptions {
  /** Whether the AI is currently working (streaming, processing) */
  working: boolean;
  /** Callback when user manually scrolls up (interrupts auto-scroll) */
  onUserInteracted?: () => void;
}

/**
 * Smart auto-scroll hook that respects user interaction.
 * 
 * Ported from OpenCode's SolidJS implementation.
 * 
 * Features:
 * - Auto-scrolls to bottom while AI is working
 * - Detects user scroll (wheel, touch, keyboard, drag)
 * - Pauses auto-scroll when user scrolls up
 * - Resumes when user returns to bottom or work completes
 * - Uses ResizeObserver to detect content changes
 */
export function useAutoScroll<T extends HTMLElement = HTMLDivElement>({ working, onUserInteracted }: AutoScrollOptions) {
  const scrollRef = useRef<T | null>(null);
  const contentRef = useRef<T | null>(null);
  const [userScrolled, setUserScrolled] = useState(false);
  
  // Refs for tracking state across event handlers
  const lastScrollTopRef = useRef(0);
  const isAutoScrollingRef = useRef(false);
  const autoScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const isMouseDownRef = useRef(false);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  /**
   * Scroll to the bottom of the container.
   * Only scrolls if:
   * - We have a scroll container
   * - User hasn't manually scrolled up
   * - AI is currently working
   */
  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el || userScrolled || !working) return;

    isAutoScrollingRef.current = true;
    
    // Clear any existing timeout
    if (autoScrollTimeoutRef.current) {
      clearTimeout(autoScrollTimeoutRef.current);
    }
    
    // Reset auto-scrolling flag after animation completes
    autoScrollTimeoutRef.current = setTimeout(() => {
      isAutoScrollingRef.current = false;
    }, 1000);

    el.scrollTo({
      top: el.scrollHeight,
      behavior: "smooth",
    });
  }, [userScrolled, working]);

  /**
   * Handle scroll events on the container.
   */
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;

    const { scrollTop, scrollHeight, clientHeight } = el;
    const atBottom = Math.abs(scrollHeight - clientHeight - scrollTop) < 10;

    // If we're auto-scrolling, ignore user scroll events
    if (isAutoScrollingRef.current) {
      if (atBottom) {
        isAutoScrollingRef.current = false;
        if (autoScrollTimeoutRef.current) {
          clearTimeout(autoScrollTimeoutRef.current);
        }
      }
      lastScrollTopRef.current = scrollTop;
      return;
    }

    // If at bottom, re-enable auto-scroll
    if (atBottom) {
      if (userScrolled) {
        setUserScrolled(false);
      }
      lastScrollTopRef.current = scrollTop;
      return;
    }

    // Detect upward scroll (user scrolling up)
    const delta = scrollTop - lastScrollTopRef.current;
    if (delta < 0 && isMouseDownRef.current && !userScrolled && working) {
      setUserScrolled(true);
      onUserInteracted?.();
    }

    lastScrollTopRef.current = scrollTop;
  }, [userScrolled, working, onUserInteracted]);

  /**
   * Handle wheel events (mouse wheel, trackpad).
   */
  const handleWheel = useCallback((e: WheelEvent) => {
    // Scrolling up
    if (e.deltaY < 0 && !userScrolled && working) {
      setUserScrolled(true);
      onUserInteracted?.();
    }
  }, [userScrolled, working, onUserInteracted]);

  /**
   * Handle touch events (mobile).
   */
  const handleTouchStart = useCallback(() => {
    if (!userScrolled && working) {
      setUserScrolled(true);
      onUserInteracted?.();
    }
  }, [userScrolled, working, onUserInteracted]);

  /**
   * Handle keyboard navigation.
   */
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (["ArrowUp", "PageUp", "Home"].includes(e.key)) {
      if (!userScrolled && working) {
        setUserScrolled(true);
        onUserInteracted?.();
      }
    }
  }, [userScrolled, working, onUserInteracted]);

  /**
   * Track mouse down state for scroll detection.
   */
  const handleMouseDown = useCallback(() => {
    isMouseDownRef.current = true;
  }, []);

  const handleMouseUp = useCallback(() => {
    isMouseDownRef.current = false;
  }, []);

  // Reset userScrolled when work completes
  useEffect(() => {
    if (!working) {
      setUserScrolled(false);
    }
  }, [working]);

  // Set up event listeners when scroll container is available
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    lastScrollTopRef.current = el.scrollTop;
    el.style.overflowAnchor = "none";

    el.addEventListener("wheel", handleWheel, { passive: true });
    el.addEventListener("touchstart", handleTouchStart, { passive: true });
    el.addEventListener("keydown", handleKeyDown);
    el.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      el.removeEventListener("wheel", handleWheel);
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("keydown", handleKeyDown);
      el.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleWheel, handleTouchStart, handleKeyDown, handleMouseDown, handleMouseUp]);

  // Set up ResizeObserver to detect content changes
  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;

    resizeObserverRef.current = new ResizeObserver(() => {
      if (working && !userScrolled) {
        scrollToBottom();
      }
    });

    resizeObserverRef.current.observe(content);

    return () => {
      resizeObserverRef.current?.disconnect();
    };
  }, [working, userScrolled, scrollToBottom]);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (autoScrollTimeoutRef.current) {
        clearTimeout(autoScrollTimeoutRef.current);
      }
    };
  }, []);

  return {
    /** Ref to attach to the scrollable container */
    scrollRef,
    /** Ref to attach to the content wrapper (for resize detection) */
    contentRef,
    /** Scroll event handler - attach to onScroll */
    handleScroll,
    /** Manual scroll to bottom function */
    scrollToBottom,
    /** Whether user has manually scrolled up */
    userScrolled,
  };
}

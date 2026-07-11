/**
 * Custom hook for managing undo/redo history
 * Implements a command pattern with a configurable max history limit
 */

import { useState, useCallback } from "react";

interface UseHistoryOptions<T> {
  initialState: T;
  maxHistory?: number;
}

interface UseHistoryReturn<T> {
  state: T;
  setState: (newState: T | ((prev: T) => T)) => void;
  /**
   * Step back one entry. Returns the state stepped INTO (so the caller can
   * apply it imperatively, e.g. push it into the canvas ahead of the poll),
   * or null when there is nothing to undo.
   */
  undo: () => T | null;
  /** Step forward one entry. Same return contract as undo. */
  redo: () => T | null;
  canUndo: boolean;
  canRedo: boolean;
  clear: () => void;
  /**
   * Replace the ENTIRE stack with a single entry. Used on programmatic loads
   * that must not be undoable into the previous content — e.g. a multi-screen
   * tab switch, where undoing across the switch would paint another screen's
   * strokes onto the current one.
   */
  reset: (newState: T) => void;
  historyIndex: number;
  historyLength: number;
}

export function useHistory<T>({
  initialState,
  maxHistory = 50,
}: UseHistoryOptions<T>): UseHistoryReturn<T> {
  const [history, setHistory] = useState<T[]>([initialState]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const state = history[currentIndex];
  const canUndo = currentIndex > 0;
  const canRedo = currentIndex < history.length - 1;

  const setState = useCallback(
    (newState: T | ((prev: T) => T)) => {
      const updatedState =
        typeof newState === "function"
          ? (newState as (prev: T) => T)(state)
          : newState;

      setHistory((prev) => {
        // Remove any "future" history when making a new change
        const newHistory = prev.slice(0, currentIndex + 1);
        newHistory.push(updatedState);

        // Limit history size
        if (newHistory.length > maxHistory) {
          return newHistory.slice(newHistory.length - maxHistory);
        }

        return newHistory;
      });

      setCurrentIndex((prev) => {
        const newIndex = prev + 1;
        return newIndex >= maxHistory ? maxHistory - 1 : newIndex;
      });
    },
    [state, currentIndex, maxHistory]
  );

  const undo = useCallback((): T | null => {
    if (!canUndo) return null;
    const target = history[currentIndex - 1];
    setCurrentIndex(currentIndex - 1);
    return target;
  }, [canUndo, history, currentIndex]);

  const redo = useCallback((): T | null => {
    if (!canRedo) return null;
    const target = history[currentIndex + 1];
    setCurrentIndex(currentIndex + 1);
    return target;
  }, [canRedo, history, currentIndex]);

  const clear = useCallback(() => {
    setHistory([initialState]);
    setCurrentIndex(0);
  }, [initialState]);

  const reset = useCallback((newState: T) => {
    setHistory([newState]);
    setCurrentIndex(0);
  }, []);

  // NOTE: this hook deliberately does NOT install its own Ctrl+Z/Ctrl+Y
  // keyboard listener. The consumer (canvas/page.tsx) owns keyboard shortcuts;
  // a second listener here made every Ctrl+Z fire undo() twice, stepping the
  // index by 2 (and past 0 into an undefined state).

  return {
    state,
    setState,
    undo,
    redo,
    canUndo,
    canRedo,
    clear,
    reset,
    historyIndex: currentIndex,
    historyLength: history.length,
  };
}

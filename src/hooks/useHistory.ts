/**
 * Custom hook for managing undo/redo history
 * Implements a command pattern with a configurable max history limit
 */

import { useState, useCallback, useEffect } from 'react';

interface UseHistoryOptions<T> {
  initialState: T;
  maxHistory?: number;
}

interface UseHistoryReturn<T> {
  state: T;
  setState: (newState: T | ((prev: T) => T)) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  clear: () => void;
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
        typeof newState === 'function'
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

  const undo = useCallback(() => {
    if (canUndo) {
      setCurrentIndex((prev) => prev - 1);
    }
  }, [canUndo]);

  const redo = useCallback(() => {
    if (canRedo) {
      setCurrentIndex((prev) => prev + 1);
    }
  }, [canRedo]);

  const clear = useCallback(() => {
    setHistory([initialState]);
    setCurrentIndex(0);
  }, [initialState]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
        e.preventDefault();
        undo();
      } else if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        (e.key === 'z' || e.key === 'Z')
      ) {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  return {
    state,
    setState,
    undo,
    redo,
    canUndo,
    canRedo,
    clear,
    historyIndex: currentIndex,
    historyLength: history.length,
  };
}

import { useState, useCallback } from "react";

export interface UseComponentStateOptions<T> {
  initialState?: T;
  enableStateHistory?: boolean;
  maxHistorySize?: number;
}

export interface UseComponentStateReturn<T> {
  state: T;
  setState: React.Dispatch<React.SetStateAction<T>>;
  reset: () => void;
  update: (updates: Partial<T>) => void;
  replace: (newState: T) => void;
  previousState?: T;
  stateHistory?: T[];
}

export function useComponentState<T>(
  initialState: T,
  options: UseComponentStateOptions<T> = {},
): UseComponentStateReturn<T> {
  const {
    initialState: defaultState,
    enableStateHistory = false,
    maxHistorySize = 10,
  } = options;

  const [state, setState] = useState<T>(initialState || (defaultState as T));
  const [previousState, setPreviousState] = useState<T | undefined>();
  const [stateHistory, setStateHistory] = useState<T[]>(
    enableStateHistory ? [initialState] : [],
  );

  const reset = useCallback(() => {
    setPreviousState(state);
    setState(initialState || (defaultState as T));

    if (enableStateHistory) {
      setStateHistory([initialState]);
    }
  }, [initialState, defaultState, state, enableStateHistory]);

  const update = useCallback(
    (updates: Partial<T>) => {
      setPreviousState(state);
      setState((prev) => ({ ...prev, ...updates }));

      if (enableStateHistory) {
        setStateHistory((prev) => {
          const newHistory = [...prev, { ...state, ...updates }];
          return newHistory.slice(-maxHistorySize);
        });
      }
    },
    [state, enableStateHistory, maxHistorySize],
  );

  const replace = useCallback(
    (newState: T) => {
      setPreviousState(state);
      setState(newState);

      if (enableStateHistory) {
        setStateHistory((prev) => [...prev, newState].slice(-maxHistorySize));
      }
    },
    [state, enableStateHistory, maxHistorySize],
  );

  return {
    state,
    setState,
    reset,
    update,
    replace,
    previousState: enableStateHistory ? previousState : undefined,
    stateHistory: enableStateHistory ? stateHistory : undefined,
  };
}

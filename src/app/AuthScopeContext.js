import React from "react";
import { captureAuthScope } from "./authScope.js";

export const AuthScopeContext = React.createContext(null);

// Capture per operation, not just per mount: StrictMode effect cleanup must not
// revive a promise from its preceding lifetime when effects are replayed.
export function useAccountScope(providedScope) {
  const inherited = React.useContext(AuthScopeContext);
  const origin = providedScope || inherited;
  const life = React.useRef({ origin, version: 0, mounted: true });
  React.useLayoutEffect(() => {
    life.current.origin = origin;
    life.current.mounted = true;
    return () => { life.current.mounted = false; life.current.version += 1; };
  }, [origin]);
  return React.useMemo(() => ({
    origin,
    isCurrent: () => Boolean(life.current.mounted && life.current.origin === origin && origin?.isCurrent()),
    capture: () => {
      const version = life.current.version;
      return captureAuthScope(origin, () => life.current.mounted && life.current.origin === origin && life.current.version === version);
    },
  }), [origin]);
}

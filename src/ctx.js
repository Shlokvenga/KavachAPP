// React context shared by every screen: { s, act, now, role, ... }.
// Kept separate from store.js so the laptop hub (Node) can import the actions
// without pulling in React.
import { createContext, useContext } from 'react';

export const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);

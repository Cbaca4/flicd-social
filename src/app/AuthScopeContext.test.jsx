/** @vitest-environment jsdom */
import React from 'react';
import { afterEach, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { createAuthBoundary } from './authScope.js';
import { AuthScopeContext, useAccountScope } from './AuthScopeContext.js';

afterEach(cleanup);
const session = { user: { id: 'A' }, session_id: 'session-A' };
function Probe({ onReady }) {
  const account = useAccountScope();
  React.useEffect(() => { onReady(account.capture()); }, [account, onReady]);
  return null;
}
it('does not revive the first operation when StrictMode replays effects', () => {
  const origin = createAuthBoundary().accept(session, 'SIGNED_IN');
  const operations = [];
  const view = render(<React.StrictMode><AuthScopeContext.Provider value={origin}><Probe onReady={scope => operations.push(scope)} /></AuthScopeContext.Provider></React.StrictMode>);
  expect(operations).toHaveLength(2);
  expect(operations[0].isCurrent()).toBe(false);
  expect(operations[1].isCurrent()).toBe(true);
  view.unmount();
  expect(operations[1].isCurrent()).toBe(false);
});
it('preserves matching-session refresh but never revives A after A to B to A', () => {
  const boundary = createAuthBoundary();
  const original = boundary.accept(session, 'SIGNED_IN');
  const operations = [];
  const ready = scope => operations.push(scope);
  const tree = scope => <AuthScopeContext.Provider value={scope}><Probe onReady={ready} /></AuthScopeContext.Provider>;
  const view = render(tree(original));
  view.rerender(tree(boundary.accept({ ...session, access_token: 'synthetic-refresh' }, 'TOKEN_REFRESHED')));
  expect(operations).toHaveLength(1);
  expect(operations[0].isCurrent()).toBe(true);
  view.rerender(tree(boundary.accept({ user: { id: 'B' }, session_id: 'session-B' }, 'SIGNED_IN')));
  expect(operations[0].isCurrent()).toBe(false);
  expect(operations[1].isCurrent()).toBe(true);
  view.rerender(tree(boundary.accept(session, 'SIGNED_IN')));
  expect(operations[0].isCurrent()).toBe(false);
  expect(operations[1].isCurrent()).toBe(false);
  expect(operations[2].isCurrent()).toBe(true);
});

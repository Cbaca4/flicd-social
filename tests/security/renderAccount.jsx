import React from 'react';
import { render } from '@testing-library/react';
import { AuthScopeContext } from '../../src/app/AuthScopeContext.js';
import { testAuthScope } from './testAuthScope.js';

export function renderAccount(ui, user, options) {
  const scope = testAuthScope(user);
  const provide = node => <AuthScopeContext.Provider value={scope}>{node}</AuthScopeContext.Provider>;
  // React only replays initial passive effects for root StrictMode. Keep it
  // outermost, and retain the same provider during Testing Library rerenders.
  const wrap = node => node.type === React.StrictMode
    ? <React.StrictMode>{provide(node.props.children)}</React.StrictMode> : provide(node);
  const view = render(wrap(ui), options);
  return { ...view, rerender: next => view.rerender(wrap(next)) };
}

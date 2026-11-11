import { captureAuthScope, createAuthBoundary } from '../../src/app/authScope.js';

// Each call owns an actual boundary, not a process-wide always-current mock.
// Callers must identify the synthetic initiating account explicitly.
export function testAuthScope(user, lifetime) {
  const boundary = createAuthBoundary();
  return captureAuthScope(boundary.accept({ user: { id: user }, session_id: `test-session-${user}` }, 'SIGNED_IN'), lifetime);
}

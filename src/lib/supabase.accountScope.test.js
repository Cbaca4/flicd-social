import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { supabase, createAccountClient } from './supabase.js';
import { createAuthBoundary } from '../app/authScope.js';

const A = { user: { id: 'A' }, session_id: 'login-A', access_token: 'synthetic-A' };
const B = { user: { id: 'B' }, session_id: 'login-B', access_token: 'synthetic-B' };
const operations = {
  PostgREST: client => client.from('boards').insert({ user_id: 'A', name: 'A private draft' }).select().single(),
  RPC: client => client.rpc('synthetic_owner_operation', { owner_id: 'A' }),
  Storage: client => client.storage.from('flicd-media').upload('A/private.webm', new Blob(['synthetic'], { type: 'audio/webm' })),
};
let wire;
beforeEach(() => {
  wire = vi.fn(async () => new Response(JSON.stringify({ id: 'saved', Key: 'A/private.webm' }), { status: 201, headers: { 'Content-Type': 'application/json' } }));
  vi.stubGlobal('fetch', wire);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
for (const [name, send] of Object.entries(operations)) {
  it.each(['B', 'ABA', 'replacement-session'])(`real SDK ${name} rejects %s credentials after deferred acquisition without dispatch`, async transition => {
    const boundary = createAuthBoundary(), origin = boundary.accept(A, 'SIGNED_IN');
    let finish;
    const getSession = vi.spyOn(supabase.auth, 'getSession').mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const result = Promise.resolve(send(createAccountClient(origin))).catch(error => ({ error }));
    await vi.waitFor(() => expect(getSession).toHaveBeenCalled());
    let replacement = B;
    if (transition === 'B' || transition === 'ABA') boundary.accept(B, 'SIGNED_IN');
    if (transition === 'ABA') { boundary.accept(A, 'SIGNED_IN'); replacement = A; }
    if (transition === 'replacement-session') replacement = { ...A, session_id: 'new-login-A' };
    finish({ data: { session: replacement }, error: null });
    expect((await result).error).toBeTruthy(); expect(wire).not.toHaveBeenCalled();
  });
  it(`real SDK ${name} rechecks its scope between token acquisition and fetch`, async () => {
    const boundary = createAuthBoundary(), origin = boundary.accept(A, 'SIGNED_IN');
    const credentials = { ...A };
    Object.defineProperty(credentials, 'access_token', { get() { boundary.accept(B, 'SIGNED_IN'); return 'synthetic-A'; } });
    vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({ data: { session: credentials }, error: null });
    expect((await Promise.resolve(send(createAccountClient(origin))).catch(error => ({ error }))).error).toBeTruthy();
    expect(wire).not.toHaveBeenCalled();
  });
  it(`real SDK ${name} preserves a matching-session refreshed credential`, async () => {
    const boundary = createAuthBoundary(), origin = boundary.accept(A, 'SIGNED_IN');
    const refreshed = { ...A, access_token: 'synthetic-A-refreshed' };
    boundary.accept(refreshed, 'TOKEN_REFRESHED');
    vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({ data: { session: refreshed }, error: null });
    expect((await send(createAccountClient(origin))).error).toBeNull();
    expect(wire).toHaveBeenCalledOnce();
    const headers = new Headers(wire.mock.calls[0][1].headers);
    expect(headers.get('Authorization')).toBe('Bearer synthetic-A-refreshed');
  });
}
it('the SDK mutation factory fails closed before constructing a client without an origin', () => {
  expect(() => createAccountClient()).toThrow('originating authentication scope');
  expect(wire).not.toHaveBeenCalled();
});

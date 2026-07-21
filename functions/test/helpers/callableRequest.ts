// functions/test/helpers/callableRequest.ts
//
// Every onCall handler in this codebase — whether imported from the v1-style top-level
// `firebase-functions` namespace or from `firebase-functions/v2/https` — is written using
// the single-parameter `async request => { request.data / request.auth }` style. `.run()`
// on a v1 handler is typed as `(data, context)` but its runtime implementation
// (`_onCallWithOptions`'s `fixedLen`) just forwards its first argument straight into the
// handler, so passing the full CallableRequest-shaped object as that first argument works
// identically to v2's single-argument `.run(request)`. One builder covers both.

export function buildRequest<T>(data: T, uid?: string): any {
  return {
    data,
    auth: uid ? { uid, token: { uid } } : undefined,
    rawRequest: {},
  };
}

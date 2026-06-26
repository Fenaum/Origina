const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

type RequestOptions = RequestInit & {
  token?: string;
};

// Token storage key — must match AuthProvider's TOKEN_KEY.
const TOKEN_STORAGE_KEY = "origina.token";

// ── Auth state ────────────────────────────────────────────────────────────────
//
// The auth token is stored at module scope so any service can call apiRequest
// without threading the token through every function. AuthProvider writes to
// this on login/logout/hydration. A 401 response clears it and invokes the
// registered handler so a stale token can never silently return 401s forever.
//
// We intentionally keep the per-call `token` override so callers that need a
// one-off token (e.g. an admin tool acting as another user) still can.
//
// IMPORTANT: apiRequest also falls back to localStorage so the very first
// request after a hard reload picks up the token synchronously, before
// AuthProvider's useEffect has had a chance to call setAuthToken(). Without
// this fallback, React Query fires its first fetch before the module-level
// authToken is hydrated → the request lands without a Bearer header → 401 →
// the user is bounced back to /login even though their token is still valid.
let authToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

function readStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token: string | null): void {
  authToken = token;
}

export function getAuthToken(): string | null {
  return authToken;
}

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

// ── Public surface ────────────────────────────────────────────────────────────

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { token, headers: rawHeaders, ...rest } = options;

  const headers = new Headers(rawHeaders as HeadersInit | undefined);

  // Don't override Content-Type for form submissions — caller sets it explicitly.
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const effectiveToken = token ?? authToken ?? readStoredToken();
  if (effectiveToken) {
    headers.set("Authorization", `Bearer ${effectiveToken}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    cache: "no-store",
    ...rest,
    headers,
  });

  if (response.status === 401) {
    // Token is invalid or expired — drop it and notify the app so it can
    // redirect to /login. We don't await the handler; the consumer still
    // receives the 401 as a thrown error below so React Query marks the
    // query failed and components render their error state.
    authToken = null;
    onUnauthorized?.();
  }

  if (!response.ok) {
    const detail = await response
      .json()
      .then((body: { detail?: unknown }) => {
        const d = body.detail;
        if (!d) return null;
        if (typeof d === "string") return d;
        // FastAPI validation errors: array of {loc, msg, type}
        if (Array.isArray(d)) {
          return (d as { loc?: string[]; msg?: string }[])
            .map((e) => [e.loc?.slice(-1)[0], e.msg].filter(Boolean).join(": "))
            .join("; ") || JSON.stringify(d);
        }
        return JSON.stringify(d);
      })
      .catch(() => null);
    throw new Error(detail ?? `API ${response.status}`);
  }

  return response.json() as Promise<T>;
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

type RequestOptions = RequestInit & {
  token?: string;
};

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

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    cache: "no-store",
    ...rest,
    headers,
  });

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

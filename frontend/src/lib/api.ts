
interface SessionResponse {
  isStaff: boolean;
  csrfToken: string;
}

export async function apiFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const method = (options.method || "GET").toUpperCase();
  const changesData = ["POST", "PUT", "PATCH", "DELETE"].includes(method);
  const headers = new Headers(options.headers);

  if (changesData) {
    const sessionResponse = await fetch("/api/auth/session", {
      method: "GET",
      cache: "no-store",
      credentials: "same-origin",
    });

    if (!sessionResponse.ok) {
      throw new Error("Unable to get a CSRF session. Reload and try again.");
    }

    const session = (await sessionResponse.json()) as SessionResponse;

    if (!session.csrfToken) {
      throw new Error("CSRF token is missing. Reload and try again.");
    }

    headers.set("X-CSRFToken", session.csrfToken);
  }

  return fetch(url, {
    ...options,
    method,
    headers,
    cache: "no-store",
    credentials: "same-origin",
  });
}

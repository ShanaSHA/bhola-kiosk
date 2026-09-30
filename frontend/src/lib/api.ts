export async function apiFetch(path:string, options:RequestInit={}) {
  const headers = new Headers(options.headers);
  if (options.method && !['GET','HEAD','OPTIONS'].includes(options.method.toUpperCase())) {
    const session = await fetch('/api/auth/session', {cache:'no-store', credentials:'same-origin'});
    if (!session.ok) throw new Error('Unable to verify your session. Please sign in again.');
    const body = await session.json();
    headers.set('X-CSRFToken', body.csrfToken);
  }
  return fetch(path, {...options, headers, credentials:'same-origin', cache:'no-store'});
}

let refreshRequest: Promise<boolean> | null = null;
let logoutRequest: Promise<void> | null = null;

function refreshSession(): Promise<boolean> {
  if (!refreshRequest) {
    refreshRequest = fetch('/api/auth/refresh', { method: 'POST' })
      .then((response) => {
        if (response.status === 401) return false;
        if (!response.ok) {
          throw new Error(`Не удалось проверить сессию (${response.status})`);
        }
        return true;
      })
      .finally(() => {
        refreshRequest = null;
      });
  }
  return refreshRequest;
}

export async function ensureSession(): Promise<boolean> {
  if (await refreshSession()) return true;
  await expireSession();
  return false;
}

function expireSession(): Promise<void> {
  if (!logoutRequest) {
    window.dispatchEvent(new Event('auth:unauthorized'));
    logoutRequest = fetch('/api/auth/logout', { method: 'POST' })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Не удалось завершить сеанс (${response.status})`);
        }
      })
      .finally(() => {
        logoutRequest = null;
      });
  }
  return logoutRequest;
}

export async function apiFetch(
  input: string,
  init?: RequestInit,
): Promise<Response> {
  const response = await fetch(input, init);
  if (response.status !== 401) return response;

  if (await refreshSession()) {
    const retriedResponse = await fetch(input, init);
    if (retriedResponse.status !== 401) return retriedResponse;
  }

  await expireSession();
  return response;
}

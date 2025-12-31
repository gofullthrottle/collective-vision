const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8787';

export function getApiKey(): string | null {
  return localStorage.getItem('cv_admin_api_key');
}

export function setApiKey(key: string): void {
  localStorage.setItem('cv_admin_api_key', key);
}

export function clearApiKey(): void {
  localStorage.removeItem('cv_admin_api_key');
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('Not authenticated');

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Token': apiKey,
      ...options.headers,
    },
  });

  if (res.status === 401) {
    clearApiKey();
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'API Error');
  }

  return res.json();
}

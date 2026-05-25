const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? 'http://localhost:4000/api';

function getToken(): string | null {
  return localStorage.getItem('bioannot_token');
}

function saveToken(token: string): void {
  localStorage.setItem('bioannot_token', token);
}

function clearToken(): void {
  localStorage.removeItem('bioannot_token');
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data as T;
}

// ── Auth ──────────────────────────────────────────────────────────────────

export interface ApiUser {
  id: string;
  name: string;
  email: string;
  role: 'annotator' | 'reviewer' | 'admin';
}

export async function apiLogin(email: string, password: string): Promise<ApiUser> {
  const data = await request<{ token: string; user: ApiUser }>('POST', '/auth/login', { email, password });
  saveToken(data.token);
  return data.user;
}

export async function apiLogout(): Promise<void> {
  try { await request('POST', '/auth/logout'); } catch { /* ignore */ }
  clearToken();
}

export async function apiMe(): Promise<ApiUser | null> {
  if (!getToken()) return null;
  try {
    const data = await request<{ user: ApiUser }>('GET', '/auth/me');
    return data.user;
  } catch {
    clearToken();
    return null;
  }
}

export async function apiRegisterUser(
  name: string, email: string, password: string, role: string
): Promise<ApiUser> {
  const data = await request<{ user: ApiUser }>('POST', '/auth/register', { name, email, password, role });
  return data.user;
}

export async function apiListUsers(): Promise<ApiUser[]> {
  const data = await request<{ users: ApiUser[] }>('GET', '/auth/users');
  return data.users;
}

export async function apiUpdateUser(
  id: string, patch: { name?: string; role?: string; password?: string }
): Promise<ApiUser> {
  const data = await request<{ user: ApiUser }>('PATCH', `/auth/users/${id}`, patch);
  return data.user;
}

export async function apiDeleteUser(id: string): Promise<void> {
  await request('DELETE', `/auth/users/${id}`);
}

export async function apiChangePassword(currentPassword: string, newPassword: string): Promise<void> {
  await request('POST', '/auth/change-password', { currentPassword, newPassword });
}

// ── Annotations ───────────────────────────────────────────────────────────

import type { Annotation } from '../types/annotations';

export async function apiFetchAnnotations(): Promise<Annotation[]> {
  const data = await request<{ annotations: Annotation[] }>('GET', '/annotations');
  return data.annotations;
}

export async function apiCreateAnnotation(
  annotation: Omit<Annotation, 'id'> & { id?: string }
): Promise<Annotation> {
  const data = await request<{ annotation: Annotation }>('POST', '/annotations', annotation);
  return data.annotation;
}

export async function apiSaveBulk(annotations: Annotation[]): Promise<void> {
  await request('POST', '/annotations/bulk', { annotations });
}

export async function apiUpdateAnnotation(
  id: string, patch: Partial<Annotation>
): Promise<Annotation> {
  const data = await request<{ annotation: Annotation }>('PATCH', `/annotations/${id}`, patch);
  return data.annotation;
}

export async function apiDeleteAnnotation(id: string): Promise<void> {
  await request('DELETE', `/annotations/${id}`);
}

export async function apiClearAnnotations(): Promise<void> {
  await request('DELETE', '/annotations');
}

export async function apiAuditLog(): Promise<unknown[]> {
  const data = await request<{ logs: unknown[] }>('GET', '/annotations/audit');
  return data.logs;
}

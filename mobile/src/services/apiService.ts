const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:5000';

// getToken is passed in from the component using useAuth().getToken
type GetTokenFn = () => Promise<string | null>;

// Simple token cache to avoid hitting Clerk on rapid successive requests
let cachedToken: string | null = null;
let tokenExpiry = 0;
const TOKEN_CACHE_MS = 30_000; // Cache token for 30 seconds

async function getAuthHeaders(getToken: GetTokenFn): Promise<Record<string, string>> {
  const now = Date.now();
  if (cachedToken && now < tokenExpiry) {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cachedToken}`,
    };
  }

  const token = await getToken();
  if (!token) throw new Error('Not authenticated');

  cachedToken = token;
  tokenExpiry = now + TOKEN_CACHE_MS;

  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

// Retry helper for rate-limited requests
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = 2,
): Promise<Response> {
  const response = await fetch(url, options);
  if (response.status === 429 && retries > 0) {
    const retryAfter = Number(response.headers.get('retry-after') || '2');
    await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
    return fetchWithRetry(url, options, retries - 1);
  }
  return response;
}

export async function syncContacts(
  getToken: GetTokenFn,
  contacts: { name: string; phone: string }[],
): Promise<void> {
  const headers = await getAuthHeaders(getToken);
  const response = await fetchWithRetry(`${API_URL}/api/contacts/sync`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ contacts }),
  });

  if (!response.ok) {
    throw new Error('Failed to sync contacts');
  }
}

export interface NetworkContact {
  name: string;
  phone: string;
  isUser: boolean;
  linkedUid: string | null;
  linkedEmail: string | null;
}

export interface NetworkSuggestion {
  name: string;
  phone: string;
  throughName: string;
  throughUid: string;
  isUser: boolean;
}

export interface NetworkData {
  contacts: NetworkContact[];
  suggestions: NetworkSuggestion[];
  stats: {
    totalContacts: number;
    usersInNetwork: number;
  };
}

export async function getMyNetwork(getToken: GetTokenFn): Promise<NetworkData> {
  const headers = await getAuthHeaders(getToken);
  const response = await fetchWithRetry(`${API_URL}/api/network/me`, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    throw new Error('Failed to get network');
  }

  return response.json();
}

export async function findConnection(
  getToken: GetTokenFn,
  targetUserId: string,
): Promise<{ path: string[]; degree: number } | null> {
  const headers = await getAuthHeaders(getToken);
  const response = await fetchWithRetry(`${API_URL}/api/network/connection/${targetUserId}`, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error('Failed to find connection');
  }

  return response.json();
}

export async function searchUsers(
  getToken: GetTokenFn,
  query: string,
): Promise<{ id: string; displayName: string; degree: number | null }[]> {
  const headers = await getAuthHeaders(getToken);
  const response = await fetchWithRetry(`${API_URL}/api/users/search?q=${encodeURIComponent(query)}`, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    throw new Error('Failed to search users');
  }

  return response.json();
}

export interface UserProfile {
  name: string | null;
  email: string;
  phone: string | null;
  location: string | null;
  college: string | null;
  highSchool: string | null;
  company: string | null;
  jobTitle: string | null;
  industry: string | null;
  hometown: string | null;
  bio: string | null;
}

export async function getMyProfile(getToken: GetTokenFn): Promise<UserProfile> {
  const headers = await getAuthHeaders(getToken);
  const response = await fetchWithRetry(`${API_URL}/api/users/me`, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    throw new Error('Failed to get profile');
  }

  return response.json();
}

export async function updateMyProfile(
  getToken: GetTokenFn,
  data: Partial<Omit<UserProfile, 'email'>>,
): Promise<void> {
  const headers = await getAuthHeaders(getToken);
  const response = await fetchWithRetry(`${API_URL}/api/users/me`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error('Failed to update profile');
  }
}

export interface MutualConnection {
  name: string;
  phone: string;
  isUser: boolean;
  linkedUid: string | null;
}

export interface MutualConnectionsData {
  targetContact: MutualConnection | null;
  mutualConnections: MutualConnection[];
  count: number;
  connectionPath: string[] | null;
  connectionDegree: number | null;
}

export async function getMutualConnections(
  getToken: GetTokenFn,
  contactPhone: string,
): Promise<MutualConnectionsData> {
  const headers = await getAuthHeaders(getToken);
  const response = await fetchWithRetry(`${API_URL}/api/network/mutual/${encodeURIComponent(contactPhone)}`, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    throw new Error('Failed to get mutual connections');
  }

  return response.json();
}

export interface AddContactResult {
  message: string;
  contact: {
    name: string;
    phone: string;
    email: string | null;
    isUser: boolean;
    linkedName: string | null;
  };
}

export async function addManualContact(
  getToken: GetTokenFn,
  data: { name: string; phone: string; email?: string },
): Promise<AddContactResult> {
  const headers = await getAuthHeaders(getToken);
  const response = await fetchWithRetry(`${API_URL}/api/contacts/add`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as any).error || 'Failed to add contact');
  }

  return response.json();
}

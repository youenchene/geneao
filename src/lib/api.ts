/**
 * API client for the Geneao backend.
 * Handles authentication, CRUD operations, and file uploads.
 */

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

// ---- Token management ----
// JWT is stored as an HttpOnly cookie by the backend (not accessible to JS).
// We track authentication state via a simple flag — the cookie is sent
// automatically by the browser with credentials: "include".

let authenticated: boolean = document.cookie.includes("geneao_token") ||
  !!sessionStorage.getItem("geneao_authenticated");

export function getToken(): string | null {
  // Token is in HttpOnly cookie, not accessible to JS
  return null;
}

export function setToken(_t: string | null) {
  // Token is managed by HttpOnly cookie from the backend.
  // We only track the authentication state for UI purposes.
  if (_t) {
    sessionStorage.setItem("geneao_authenticated", "true");
    authenticated = true;
  } else {
    sessionStorage.removeItem("geneao_authenticated");
    authenticated = false;
  }
}

export function isAuthenticated(): boolean {
  return authenticated;
}

// ---- Fetch wrapper ----

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };
  // Auth is handled via HttpOnly cookie (sent automatically with credentials: "include")
  // Only set Content-Type if body is not FormData
  if (options.body && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    credentials: "include", // send HttpOnly cookies with every request
  });

  if (response.status === 401) {
    setToken(null);
    window.location.reload();
    throw new Error("Unauthorized");
  }

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(err.error || response.statusText);
  }

  return response.json();
}

// ---- Auth ----

export async function login(password: string): Promise<string> {
  const res = await apiFetch<{ token: string }>("/api/login", {
    method: "POST",
    body: JSON.stringify({ password }),
  });
  setToken(res.token);
  return res.token;
}

export function logout() {
  setToken(null);
}

// ---- Config ----

export interface AppConfig {
  title: string;
}

/** Fetch public frontend configuration (no auth required). */
export function getConfig(): Promise<AppConfig> {
  return apiFetch("/api/config");
}

// ---- Types ----

export interface ApiIndividual {
  id: string;
  gedcom_id: string;
  given_name: string;
  surname: string;
  sex: "M" | "F" | "U";
  birth_date: string;
  birth_place: string;
  death_date: string;
  death_place: string;
  living_place: string;
  note: string;
  photo_key: string;
  photo_url: string;
  created_at: string;
  updated_at: string;
}

export interface ApiFamily {
  id: string;
  gedcom_id: string;
  husband_id: string | null;
  wife_id: string | null;
  marriage_date: string;
  marriage_place: string;
  divorce_date: string;
  note: string;
  child_ids: string[];
  created_at: string;
  updated_at: string;
}

export interface TreeData {
  individuals: ApiIndividual[];
  families: ApiFamily[];
}

export interface CreateIndividualPayload {
  given_name: string;
  surname: string;
  sex: "M" | "F" | "U";
  birth_date?: string;
  birth_place?: string;
  death_date?: string;
  death_place?: string;
  living_place?: string;
  note?: string;
}

export interface CreateFamilyPayload {
  husband_id?: string | null;
  wife_id?: string | null;
  marriage_date?: string;
  marriage_place?: string;
  divorce_date?: string;
  note?: string;
  child_ids?: string[];
}

// ---- Individuals ----

export function listIndividuals(): Promise<ApiIndividual[]> {
  return apiFetch("/api/individuals");
}

export function getIndividual(id: string): Promise<ApiIndividual> {
  return apiFetch(`/api/individuals/${id}`);
}

export function createIndividual(data: CreateIndividualPayload): Promise<ApiIndividual> {
  return apiFetch("/api/individuals", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateIndividual(id: string, data: CreateIndividualPayload): Promise<ApiIndividual> {
  return apiFetch(`/api/individuals/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function uploadPhoto(id: string, file: File): Promise<{ photo_url: string; photo_key: string }> {
  const formData = new FormData();
  formData.append("photo", file);
  return apiFetch(`/api/individuals/${id}/photo`, {
    method: "POST",
    body: formData,
  });
}

// ---- Families ----

export function listFamilies(): Promise<ApiFamily[]> {
  return apiFetch("/api/families");
}

export function getFamily(id: string): Promise<ApiFamily> {
  return apiFetch(`/api/families/${id}`);
}

export function createFamily(data: CreateFamilyPayload): Promise<ApiFamily> {
  return apiFetch("/api/families", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateFamily(id: string, data: CreateFamilyPayload): Promise<ApiFamily> {
  return apiFetch(`/api/families/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

// ---- Tree ----

export function getTree(): Promise<TreeData> {
  return apiFetch("/api/tree");
}

// ---- GEDCOM ----

export function exportGedcom(): Promise<string> {
  return apiFetch("/api/gedcom/export");
}

/**
 * Fetch the .ged file content from the backend (which reads from S3).
 */
export async function fetchGedcomFile(): Promise<string> {
  const response = await fetch(`${API_URL}/api/gedcom/file`, {
    credentials: "include",
  });
  if (response.status === 401) {
    setToken(null);
    window.location.reload();
    throw new Error("Unauthorized");
  }
  if (!response.ok) {
    throw new Error(`Failed to fetch GEDCOM: ${response.status}`);
  }
  return response.text();
}

export function importGedcom(file: File): Promise<{ message: string; s3_key: string }> {
  const formData = new FormData();
  formData.append("file", file);
  return apiFetch("/api/gedcom/import", {
    method: "POST",
    body: formData,
  });
}

/**
 * Download the latest GEDCOM backup from S3 via the backend.
 */
export async function downloadLatestGedcom(): Promise<void> {
  const response = await fetch(`${API_URL}/api/gedcom/download-latest`, {
    credentials: "include",
  });
  
  if (response.status === 401) {
    setToken(null);
    window.location.reload();
    throw new Error("Unauthorized");
  }
  
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(err.error || "Failed to download GEDCOM");
  }
  
  // Get filename from Content-Disposition header if available
  const contentDisposition = response.headers.get("Content-Disposition");
  let filename = "geneao_backup.ged";
  if (contentDisposition) {
    const match = contentDisposition.match(/filename="?([^"]+)"?/);
    if (match && match[1]) {
      filename = match[1];
    }
  }
  
  // Create a blob and trigger download
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

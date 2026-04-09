import { auth } from "@/lib/firebase/config";
import type { ApiResponse } from "@/types";

async function getAuthHeaders(): Promise<HeadersInit> {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  const token = await user.getIdToken();
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

async function handleResponse<T>(response: Response): Promise<T> {
  const data: ApiResponse<T> = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || "Request failed");
  }
  return data.data as T;
}

export const api = {
  async get<T>(url: string): Promise<T> {
    const headers = await getAuthHeaders();
    const response = await fetch(url, { headers });
    return handleResponse<T>(response);
  },

  async post<T>(url: string, body?: unknown): Promise<T> {
    const headers = await getAuthHeaders();
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    return handleResponse<T>(response);
  },

  async patch<T>(url: string, body: unknown): Promise<T> {
    const headers = await getAuthHeaders();
    const response = await fetch(url, {
      method: "PATCH",
      headers,
      body: JSON.stringify(body),
    });
    return handleResponse<T>(response);
  },

  async delete<T>(url: string): Promise<T> {
    const headers = await getAuthHeaders();
    const response = await fetch(url, {
      method: "DELETE",
      headers,
    });
    return handleResponse<T>(response);
  },
};

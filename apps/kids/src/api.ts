import type { ChildBootstrap, ChildVideoPage } from "./types";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

export async function fetchBootstrap(accessToken: string): Promise<ChildBootstrap> {
  return apiFetch("/kids/bootstrap", accessToken);
}

export async function fetchChannelVideos(
  accessToken: string,
  channelId: string,
  cursor = "0",
  limit = 50
): Promise<ChildVideoPage> {
  return apiFetch(
    `/kids/channels/${encodeURIComponent(channelId)}/videos?limit=${encodeURIComponent(String(limit))}&cursor=${encodeURIComponent(cursor)}`,
    accessToken
  );
}

async function apiFetch<T>(path: string, accessToken: string): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: {
      "x-child-access-token": accessToken
    }
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(data?.error || `API returned ${response.status}.`);
  }

  return data as T;
}

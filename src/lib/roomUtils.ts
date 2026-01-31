/**
 * Generates a random room ID for game sessions
 * Format: 6-character alphanumeric string
 */
export function generateRoomId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Gets room ID from URL query parameters
 * Returns null if not present
 */
export function getRoomIdFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get("room");
}

/**
 * Updates the URL with a new room ID without page reload
 */
export function setRoomIdInUrl(roomId: string): void {
  const url = new URL(window.location.href);
  url.searchParams.set("room", roomId);
  window.history.pushState({}, "", url);
}

/**
 * Gets the room link for sharing
 */
export function getRoomLink(roomId: string): string {
  const url = new URL(window.location.href);
  url.searchParams.set("room", roomId);
  return url.toString();
}

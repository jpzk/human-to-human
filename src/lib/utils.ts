import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Calculates the relative luminance of a color and returns appropriate text color
 * @param color - Hex color string (e.g., "#F89A8A")
 * @returns "#000000" for light colors, "#FFFFFF" for dark colors
 */
export function getContrastTextColor(color: string): string {
  if (!color) return "#000000";
  
  // Remove # if present and ensure we have 6 hex digits
  const hex = color.replace("#", "").padEnd(6, "0").substring(0, 6);
  
  // Parse RGB values
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;
  
  // Calculate relative luminance using WCAG formula
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  
  // Use white text for dark backgrounds, black text for light backgrounds
  return luminance > 0.5 ? "#000000" : "#FFFFFF";
}

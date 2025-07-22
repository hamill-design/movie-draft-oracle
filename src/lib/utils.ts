
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Helper function to extract clean actor name from option field
 * Handles corrupted data that contains pipe characters
 */
export function getCleanActorName(option: string): string {
  // If the option contains a pipe character, it's corrupted data - extract just the name
  return option.includes('|') ? option.split('|')[0] : option;
}

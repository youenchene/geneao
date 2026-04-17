/**
 * Helpers for reading/writing the onboarding completion flag in localStorage.
 */

const STORAGE_KEY = "geneao_onboarding_done";

/** Returns true if the user has already completed (or skipped) the onboarding. */
export function isOnboardingDone(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

/** Mark the onboarding as completed so it won't show again. */
export function markOnboardingDone(): void {
  try {
    localStorage.setItem(STORAGE_KEY, "true");
  } catch {
    // localStorage unavailable — silently ignore.
  }
}

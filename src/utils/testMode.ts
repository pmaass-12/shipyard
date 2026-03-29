/**
 * Test Mode utility — src/utils/testMode.ts (Build 007)
 *
 * Session-scoped Test Mode state. Lives in sessionStorage — cleared on tab close.
 * All Supabase write calls in the deployed app should check TestMode.isActive()
 * and return a no-op / mock response instead of writing to the DB.
 */

export const TestMode = {
  /** True when a valid PIN has been entered in this browser session. */
  isActive(): boolean {
    try {
      return sessionStorage.getItem('isTestMode') === 'true';
    } catch {
      return false; // SSR / no access to sessionStorage
    }
  },

  /** Activate Test Mode (called after successful PIN validation). */
  activate(projectId: string): void {
    sessionStorage.setItem('isTestMode', 'true');
    sessionStorage.setItem('testModeProjectId', projectId);
  },

  /** Deactivate Test Mode and return to the login screen. */
  deactivate(): void {
    sessionStorage.removeItem('isTestMode');
    sessionStorage.removeItem('testModeProjectId');
    window.location.href = '/login';
  },

  /** The project_id that was used to enter Test Mode (or null). */
  getProjectId(): string | null {
    try {
      return sessionStorage.getItem('testModeProjectId');
    } catch {
      return null;
    }
  },
};

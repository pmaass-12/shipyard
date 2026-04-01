/**
 * extractErrorMessage — Build 062
 *
 * Safely extracts a human-readable message from any thrown value.
 *
 * Handles:
 *   - native Error instances         → err.message
 *   - Supabase PostgrestError        → err.message (plain object, not an Error)
 *   - strings thrown directly        → the string itself
 *   - anything else                  → fallback
 *
 * Usage:
 *   import { extractErrorMessage } from '@/lib/extractErrorMessage';
 *   ...
 *   } catch (err) {
 *     setError(extractErrorMessage(err, 'Save failed'));
 *   }
 */

export function extractErrorMessage(err: unknown, fallback = 'Something went wrong'): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  if (
    err !== null &&
    typeof err === 'object' &&
    'message' in err &&
    typeof (err as Record<string, unknown>).message === 'string'
  ) {
    return (err as Record<string, unknown>).message as string;
  }
  return fallback;
}

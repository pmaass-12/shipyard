/**
 * Wizard API — src/api/wizard.ts
 *
 * All Supabase and edge function calls for the Setup Wizard (Build 032).
 * Incremental saving of wizard state: identity, audience, monetization.
 *
 * This is separate from SetupScreen (Build 004/005) which is a checklist
 * of various setup tasks. SetupWizardScreen is a guided onboarding flow.
 */

import { supabase } from '@/lib/supabase';
import type { AudienceType, MonetizationType } from '@/types/db';

// ── Identity (Screen 1) ───────────────────────────────────────────────────

export interface WizardIdentity {
  name:        string;  // 1–60 chars
  description: string;  // 0–200 chars
  color:       string;  // hex, e.g. '#5b5bd6'
}

/**
 * Save product identity (name, description, color) to the projects table.
 * Called on Screen 1 "Next" button.
 */
export async function saveWizardIdentity(
  projectId: string,
  identity: WizardIdentity,
): Promise<void> {
  // Validate
  if (!identity.name.trim()) throw new Error('Product name is required.');
  if (identity.name.length > 60) throw new Error('Name must be 60 characters or fewer.');
  if (identity.description.length > 200)
    throw new Error('Description must be 200 characters or fewer.');
  if (!identity.color) throw new Error('Color is required.');

  // Update project row
  const { error } = await supabase
    .from('projects')
    .update({
      name: identity.name.trim(),
      description: identity.description.trim() || null,
      color: identity.color, // Assumes projects table has color enum column
    })
    .eq('id', projectId);

  if (error) throw error;
}

// ── Audience (Screen 2) ───────────────────────────────────────────────────

/**
 * Save audience type (personal | b2c | b2b) to wizard_config.
 * Called on Screen 2 "Next" button.
 */
export async function saveAudienceType(
  projectId: string,
  audienceType: AudienceType,
): Promise<void> {
  if (!['personal', 'b2c', 'b2b'].includes(audienceType)) {
    throw new Error('Invalid audience type.');
  }

  // Upsert wizard_config row for this project
  const { error } = await supabase
    .from('wizard_config')
    .upsert(
      { project_id: projectId, audience_type: audienceType },
      { onConflict: 'project_id' },
    );

  if (error) throw error;
}

// ── Monetization (Screen 3) ───────────────────────────────────────────────

/**
 * Save monetization type (free | adsense | subscription | one_time) to wizard_config.
 * Called on Screen 3 "Next" button.
 * Silently skipped for personal audience (Screen 3 not shown).
 */
export async function saveMonetizationType(
  projectId: string,
  monetizationType: MonetizationType,
): Promise<void> {
  if (!['free', 'adsense', 'subscription', 'one_time'].includes(monetizationType)) {
    throw new Error('Invalid monetization type.');
  }

  const { error } = await supabase
    .from('wizard_config')
    .update({ monetization_type: monetizationType })
    .eq('project_id', projectId);

  if (error) throw error;
}

// ── Completion (Screen 5) ──────────────────────────────────────────────────

/**
 * Trigger wizard defaults edge function.
 * Called on Screen 5 "Let's start building" CTA.
 *
 * POST /functions/v1/generate-wizard-defaults with { project_id }
 * Generates default screens, features, and other project scaffolding.
 */
export async function triggerWizardDefaults(
  projectId: string,
  sessionToken: string,
): Promise<void> {
  const response = await fetch('/functions/v1/generate-wizard-defaults', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${sessionToken}`,
    },
    body: JSON.stringify({ project_id: projectId }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Wizard defaults failed: ${error}`);
  }
}

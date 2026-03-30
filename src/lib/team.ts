/**
 * Named Team constants — Build 040
 *
 * Five canonical team members. No DB table — these are static constants
 * imported wherever team member identity, avatars, or attribution is needed.
 */

export type TeamMemberSlug = 'morgan' | 'wren' | 'sage' | 'finn' | 'quinn';

export interface TeamMember {
  slug:        TeamMemberSlug;
  name:        string;
  role:        string;
  description: string;   // one-liner for Admin Console roster
  color:       string;   // CSS hex
  initials:    string;
}

export const TEAM: Record<TeamMemberSlug, TeamMember> = {
  morgan: {
    slug:        'morgan',
    name:        'Morgan',
    role:        'Product Manager',
    description: 'Strategic, curious, asks good questions. Writes PRDs, runs the project chat, generates the daily briefing.',
    color:       '#475569',   // slate-600
    initials:    'M',
  },
  wren: {
    slug:        'wren',
    name:        'Wren',
    role:        'Designer',
    description: 'Creative, precise. Produces HTML mockups and design specs.',
    color:       '#D97706',   // amber-600
    initials:    'W',
  },
  sage: {
    slug:        'sage',
    name:        'Sage',
    role:        'Data Schema',
    description: 'Methodical, exact. Writes migrations, contracts, and RLS policies.',
    color:       '#65A86A',   // sage green
    initials:    'S',
  },
  finn: {
    slug:        'finn',
    name:        'Finn',
    role:        'Engineer',
    description: 'Gets things done. Implements features, pushes to GitHub.',
    color:       '#0F766E',   // teal-700
    initials:    'F',
  },
  quinn: {
    slug:        'quinn',
    name:        'Quinn',
    role:        'QA',
    description: 'Thorough, never lets anything slide. Writes and runs Playwright tests.',
    color:       '#7C3AED',   // violet-700
    initials:    'Q',
  },
};

export const TEAM_LIST: TeamMember[] = Object.values(TEAM);

/** Which team member owns each pipeline stage — shown on PipelineStrip hover */
export const PIPELINE_STAGE_MEMBER: Record<string, string> = {
  Design:   'Morgan & Wren',
  Schema:   'Sage',
  Code:     'Finn',
  Preview:  'Finn',
  QA:       'Quinn',
  Live:     '✓',
};

/** Suggested opening prompts for Project Brain empty chat state — Build 043 */
export const PM_CHAT_SUGGESTED_PROMPTS = [
  'Why did we cancel Build 024?',
  "What's the auth pattern we settled on?",
  'Walk me through the current schema',
  "What's blocking us right now?",
] as const;

// ── Enums (values must match Postgres enums exactly) ─────────────────────

export type ProjectStatus     = 'active' | 'paused' | 'stalled' | 'shipped';
export type FeatureStatus     = 'design' | 'schema' | 'code_gen' | 'deploy' | 'qa' | 'done';
export type FeatureComplexity = 'simple' | 'medium' | 'complex'; // weights: 1 / 2 / 3 pts
export type BugSeverity       = 'p0' | 'p1' | 'p2' | 'p3';
export type BugStatus         = 'open' | 'in_progress' | 'resolved' | 'wontfix';

// Engineer extension: color enum added from handoff spec (not in contract v1).
// NOTE: requires `color project_color_enum` column in the `projects` table.
// Coordinate with Schema Designer before the migration if this column is missing.
export type ProjectColor = 'blue' | 'purple' | 'orange' | 'green' | 'teal' | 'rose';

// Tech stack tags (stored as text[] in DB).
// Engineer extension: not in contract v1 — requires `tech_stack text[]` column.
export type TechStackTag =
  | 'react18'
  | 'typescript'
  | 'vite'
  | 'tailwind'
  | 'supabase'
  | 'react-router-v6';

export const TECH_STACK_LABELS: Record<TechStackTag, string> = {
  'react18':          'React 18',
  'typescript':       'TypeScript',
  'vite':             'Vite',
  'tailwind':         'Tailwind CSS',
  'supabase':         'Supabase',
  'react-router-v6':  'React Router v6',
};

export const DEFAULT_TECH_STACK: TechStackTag[] = [
  'react18', 'typescript', 'vite', 'tailwind', 'supabase', 'react-router-v6',
];

// ── Raw projects row ──────────────────────────────────────────────────────

export interface Project {
  id:               string;
  user_id:          string;
  name:             string;           // 1–60 chars
  description:      string | null;    // max 200 chars
  emoji:            string;           // single emoji, default '🚀' (kept in DB, not shown on card)
  color:            ProjectColor;     // monogram background color — Engineer extension
  status:           ProjectStatus;
  repo_url:         string | null;    // GitHub repo URL
  budget_usd:       number | null;
  tech_stack:       TechStackTag[];   // Engineer extension: persisted tag array
  last_activity_at: string;           // ISO 8601
  created_at:       string;
  updated_at:       string;
}

// ── project_summary view row ──────────────────────────────────────────────
// What the list screen fetches — one query, all card data.

export interface ProjectSummary extends Project {
  screen_count:         number;
  feature_count:        number;
  features_done:        number;
  features_in_progress: number;
  // Complexity-weighted done_pts / total_pts * 100, rounded to 1 decimal.
  // null when the project has no features yet.
  pct_complete:         number | null;
  open_bug_count:       number;
  last_deploy_date:     string | null; // ISO 8601 or null if never deployed
}

// ── Input types ───────────────────────────────────────────────────────────

export type NewProjectInput = {
  name:         string;                // required, 1–60 chars
  description?: string | null;         // max 200 chars
  color?:       ProjectColor;          // defaults to 'blue' client-side if omitted
  emoji?:       string;                // defaults to '🚀' server-side if omitted
  repo_url?:    string | null;
  budget_usd?:  number | null;
  tech_stack?:  TechStackTag[];
};

export type UpdateProjectInput = Partial<Pick<Project,
  'name' | 'emoji' | 'color' | 'description' | 'status' | 'repo_url' | 'budget_usd' | 'tech_stack'
>>;

// ── Feature ───────────────────────────────────────────────────────────────

export interface Feature {
  id:              string;
  screen_id:       string;
  name:            string;
  description:     string | null;
  status:          FeatureStatus;
  complexity:      FeatureComplexity;
  current_version: number;
  created_at:      string;
  updated_at:      string;
}

export type NewFeatureInput = {
  name:         string;
  description?: string | null;
  complexity?:  FeatureComplexity; // defaults to 'medium' server-side
};

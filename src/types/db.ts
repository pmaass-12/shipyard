// ── Enums (values must match Postgres enums exactly) ─────────────────────

export type ProjectStatus     = 'active' | 'paused' | 'stalled' | 'shipped';
export type FeatureStatus     = 'design' | 'schema' | 'code_gen' | 'deploy' | 'qa' | 'done';
export type FeatureComplexity = 'simple' | 'medium' | 'complex'; // weights: 1 / 2 / 3 pts
export type BugSeverity       = 'p0' | 'p1' | 'p2' | 'p3';
export type BugStatus         = 'open' | 'in_progress' | 'resolved' | 'wontfix';

// Build 006: Project phase + Feature maturity
export type ProjectPhase    = 'alpha' | 'beta' | 'live';
export type FeatureMaturity = 'alpha' | 'beta' | 'production';

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
  // Build 006: phase lifecycle
  phase:                   ProjectPhase;
  pushed_to_production_at: string | null;   // ISO 8601; null = never pushed
  // Build 007: Test Mode
  test_mode_enabled: boolean;
  // test_mode_pin intentionally absent — never returned to client
  // Build 008: Onboarding Tour
  onboarding_tour_enabled:  boolean;
  tour_last_generated_at:   string | null;
  // Build 009: What's New
  whats_new_enabled: boolean;
  // Build 011: Waitlist
  waitlist_enabled: boolean;
  repo_url:         string | null;    // GitHub repo URL
  budget_usd:       number | null;
  tech_stack:       TechStackTag[];   // Engineer extension: persisted tag array
  default_model:    string;           // e.g. 'claude-sonnet-4-6'; inherited by iterations
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
  // Build 006: maturity breakdown counts from rebuilt project_summary view
  features_alpha:      number;
  features_beta:       number;
  features_production: number;
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
  | 'name' | 'emoji' | 'color' | 'description' | 'status' | 'repo_url' | 'budget_usd'
  | 'tech_stack' | 'default_model'
  | 'phase'                      // Build 006
  | 'test_mode_enabled'          // Build 007
  | 'onboarding_tour_enabled'    // Build 008
  | 'whats_new_enabled'          // Build 009
  | 'waitlist_enabled'           // Build 011
>>;

// Build 006: Phase advancement (alpha → beta only; live is set by push-to-production)
export interface UpdateProjectPhaseInput {
  phase: ProjectPhase;
}

export interface PushToProductionInput {
  project_id: string;
}

// Build 007: PIN payloads
export interface ValidatePinRequest {
  project_id: string;
  pin:        string;   // raw 4–6 digit PIN (sent over HTTPS to Edge Function)
}

export interface ValidatePinResponse {
  valid:    boolean;
  reason?:  'not_configured' | 'disabled';
}

export interface SetPinRequest {
  project_id: string;
  pin:        string;   // raw PIN — hashed server-side
}

export interface UpdateTestModeRequest {
  project_id:        string;
  test_mode_enabled: boolean;
}

// Build 008: Onboarding Tour
export interface TourStep {
  id:              string;
  project_id:      string;
  step_order:      number;      // ascending; gaps allowed
  title:           string;
  description:     string;
  target_selector: string | null; // null = intro/outro (centered tooltip)
  generated_at:    string;        // ISO 8601
  updated_at:      string;        // ISO 8601
}

// Build 010: SEO / AEO Settings
export type RobotsDirective = 'index' | 'noindex';

export interface SeoSettings {
  id:                string;
  project_id:        string;
  // SEO
  meta_title:        string | null;
  meta_description:  string | null;
  og_title:          string | null;
  og_description:    string | null;
  og_image_url:      string | null;
  keywords:          string[] | null;    // TEXT[] from Postgres
  robots_directive:  RobotsDirective;
  sitemap_enabled:   boolean;
  // AEO
  llms_txt:          string | null;
  json_ld:           Record<string, unknown> | null;
  ai_description:    string | null;
  // Generation + publish state
  generated_at:      string | null;      // ISO 8601
  is_published:      boolean;
  last_published_at: string | null;      // ISO 8601
  updated_at:        string;
}

export type SeoSettingsPatch = Partial<Pick<SeoSettings,
  | 'meta_title' | 'meta_description'
  | 'og_title' | 'og_description' | 'og_image_url'
  | 'keywords' | 'robots_directive' | 'sitemap_enabled'
  | 'llms_txt' | 'json_ld' | 'ai_description'
>>;

/** Computed client-side — true when there are unsaved changes since last publish. */
export function seoIsDirty(s: SeoSettings): boolean {
  if (!s.is_published) return true;
  if (!s.last_published_at) return false;  // never published → not dirty
  return new Date(s.updated_at) > new Date(s.last_published_at);
}

// Build 009: What's New
export type ReleaseNoteItemType = 'feature' | 'bug_fix';

export interface ReleaseNote {
  id:               string;
  project_id:       string;
  release_date:     string;   // ISO date string e.g. "2026-03-28"
  push_snapshot_at: string;   // ISO 8601 timestamp
  generated_at:     string;
  updated_at:       string;
}

export interface ReleaseNoteItem {
  id:              string;
  release_note_id: string;
  item_type:       ReleaseNoteItemType;
  content:         string;    // AI-written one-sentence description
  sort_order:      number;
  created_at:      string;
  updated_at:      string;
}

export interface ReleaseNoteWithItems extends ReleaseNote {
  items: ReleaseNoteItem[];
}

// ── Feature ───────────────────────────────────────────────────────────────

// Build 016: new columns on features table
export type FeaturePriority   = 'p0' | 'p1' | 'p2' | 'p3';
export type FeatureLifecycle  = 'in_progress' | 'shipped' | 'paused';

export interface Feature {
  id:              string;
  project_id:      string;           // Build 016: direct FK
  screen_id:       string | null;    // nullable — features can be unlinked from screens
  name:            string;
  description:     string | null;
  status:          FeatureStatus;
  complexity:      FeatureComplexity;
  current_version: number;
  maturity:        FeatureMaturity;  // Build 006 — defaults from project phase at creation
  priority:        FeaturePriority;  // Build 016
  workflow_step:   number;           // Build 016: 1–5, denormalized current step
  lifecycle:       FeatureLifecycle; // Build 016: overall builder-visible status
  // Widget/CR-origin columns (null for manually-created features):
  source:          'manual' | 'widget' | 'change_request';
  screenshot_url:  string | null;
  annotations:     Annotation[] | null;
  created_at:      string;
  updated_at:      string;
}

// Lightweight row used in Screens detail Features tab
export interface ScreenFeatureRow {
  id:           string;
  name:         string;
  maturity:     FeatureMaturity;
  status:       FeatureStatus;
  workflow_step: number;
  complexity:   FeatureComplexity;
  priority:     FeaturePriority;
  created_at:   string;
}

export type NewFeatureInput = {
  name:         string;
  description?: string | null;
  complexity?:  FeatureComplexity; // defaults to 'medium' server-side
};

// ── Profile ───────────────────────────────────────────────────────────────

export interface Profile {
  id:                     string;
  name:                   string;
  email:                  string;
  role:                   UserRole;
  status:                 UserStatus;
  auth_method:            'email' | 'google' | 'github';
  last_sign_in_at:        string | null;
  // Build 008: Tour
  tour_seen_at:            string | null;
  // Build 009: What's New
  whats_new_last_seen_at:  string | null;
  created_at:             string;
  updated_at:             string;
}

// ── Bug ───────────────────────────────────────────────────────────────────

export interface Bug {
  id:             string;
  screen_id:      string;
  title:          string;
  description:    string | null;
  severity:       BugSeverity;
  status:         BugStatus;
  // Widget-capture columns (nullable for manually-filed bugs):
  screenshot_url: string | null;
  annotations:    Annotation[] | null;
  console_errors: ConsoleError[] | null;
  route:          string | null;
  user_agent:     string | null;
  captured_at:    string | null; // ISO 8601
  created_at:     string;
  updated_at:     string;
}

// ── ChangeRequest ─────────────────────────────────────────────────────────

export type ChangeRequestStatus = 'pending' | 'accepted' | 'rejected';

// Build 012: structured annotation pin (replaces reading raw JSONB for UI)
export interface CrAnnotation {
  id:         string;
  cr_id:      string;
  pin_number: 1 | 2 | 3;
  x_pct:      number;   // 0–100, percentage of screenshot width
  y_pct:      number;   // 0–100, percentage of screenshot height
  note:       string | null;
}

// Build 012: full CR row (admin UI detail panel)
export interface ChangeRequest {
  id:               string;
  project_id:       string;          // Build 012: direct FK; RLS anchor
  screen_id:        string | null;   // nullable — unlinked CRs allowed
  feature_id:       string | null;   // set on Accept
  title:            string | null;   // short summary
  description:      string | null;
  screenshot_url:   string | null;
  route:            string | null;   // e.g. '/dashboard'
  status:           ChangeRequestStatus;
  rejection_reason: string | null;
  submitted_at:     string;          // ISO timestamptz
  reviewed_at:      string | null;   // stamped on Accept or Reject
  submitter_email:  string | null;
  // JSONB columns from migration 002 — read for legacy rows only:
  annotations:      Annotation[] | null;
  console_errors:   ConsoleError[] | null;
}

// Build 012: lightweight type for card list (no JSONB blobs)
export interface ChangeRequestSummary {
  id:              string;
  project_id:      string;
  screen_id:       string | null;
  feature_id:      string | null;
  title:           string | null;
  description:     string | null;
  screenshot_url:  string | null;
  route:           string | null;
  status:          ChangeRequestStatus;
  submitted_at:    string;
  reviewed_at:     string | null;
  submitter_email: string | null;
}

// Build 012: used by Screens list card count chips
export interface PendingCrCountByScreen {
  screen_id:     string;
  pending_count: number;
}

// ── JSONB sub-shapes ──────────────────────────────────────────────────────

export interface Annotation {
  id:    number;  // sequential pin number ①②③…
  x:     number;  // fraction of image width  (0–1)
  y:     number;  // fraction of image height (0–1)
  label: string;  // short description typed by user
}

export interface ConsoleError {
  level:     'error' | 'warn' | 'log';
  message:   string;
  source:    string;    // 'filename.js:lineNumber'
  timestamp: string;   // ISO 8601
}

// ── Iteration ─────────────────────────────────────────────────────────────

export interface Iteration {
  id:             string;
  feature_id:     string;
  version_number: number;
  prompt:         string;
  model_override: string | null; // null = use projects.default_model
  generated_code: object | null;
  deployed_url:   string | null;
  deployed_at:    string | null;
  test_results:   object | null;
  created_at:     string;
  updated_at:     string;
}

// ── Widget payload types (sent to Edge Functions) ─────────────────────────

export interface BugPayload {
  type:           'bug';
  screen_id:      string;
  route:          string;
  severity:       BugSeverity;
  description:    string;
  screenshot_url: string;
  annotations:    Annotation[];
  console_errors: ConsoleError[];
  user_agent:     string;
  captured_at:    string;
}

export interface ChangePayload {
  type:           'change';
  screen_id:      string;
  feature_id?:    string | null;
  route:          string;
  description:    string;
  screenshot_url: string;
  annotations:    Annotation[];
  console_errors: ConsoleError[];
  captured_at:    string;
}

export interface FeaturePayload {
  type:           'feature';
  screen_id:      string;
  route:          string;
  description:    string;
  screenshot_url: string;
  annotations:    Annotation[];
  captured_at:    string;
}

// ── Build 011: Waitlist ────────────────────────────────────────────────────

export type WaitlistStatus = 'pending' | 'approved' | 'rejected';

export interface WaitlistSignup {
  id:               string;
  project_id:       string;
  name:             string;
  email:            string;
  source:           string | null;
  status:           WaitlistStatus;
  submitted_at:     string;           // ISO 8601
  approved_at:      string | null;
  approved_by:      string | null;    // admin user ID (not FK)
  rejection_reason: string | null;
  invite_token:     string | null;    // null = not yet approved or already used
  invite_sent_at:   string | null;
}

export interface WaitlistHighlight {
  id:          string;
  project_id:  string;
  sort_order:  number;
  icon:        string;
  title:       string;
  description: string;
  updated_at:  string;
}

export interface WaitlistStats {
  project_id: string;
  total:      number;
  pending:    number;
  approved:   number;
  rejected:   number;
}

export interface WaitlistSignupRequest {
  project_id: string;
  name:       string;
  email:      string;
  source:     string;
}

export interface WaitlistSignupResponse {
  success:    boolean;
  duplicate?: boolean;
}

// ── Admin types ───────────────────────────────────────────────────────────

export type UserRole   = 'owner' | 'admin' | 'member' | 'viewer';
export type UserStatus = 'active' | 'suspended' | 'pending';

export interface AdminUserProfile {
  id:              string;
  email:           string;
  name:            string;
  role:            UserRole;
  status:          UserStatus;
  auth_method:     'email' | 'google' | 'github';
  last_sign_in_at: string | null; // ISO 8601
  created_at:      string;
}

export type AuditAction =
  | 'role_changed'
  | 'account_suspended'
  | 'account_restored'
  | 'password_reset_sent'
  | 'impersonation_started'
  | 'impersonation_ended'
  | 'data_exported'
  | 'account_deleted_rtbf'
  | 'feature_toggled';

export interface AuditLogEntry {
  id:                string;
  performed_at:      string;         // ISO 8601 (NOT created_at — column is performed_at in DB)
  admin_user_id:     string;
  admin_name:        string | null;  // populated via profiles JOIN; null if admin was RTBF'd
  admin_email:       string;
  action:            AuditAction;
  target_user_id:    string | null;  // retained after RTBF
  target_user_email: string | null;  // nulled on RTBF
  target_user_name:  string | null;  // nulled on RTBF
  details:           string | null;
}

export interface ImpersonationToken {
  id:         string;
  token:      string;
  admin_id:   string;
  target_id:  string;
  expires_at: string;  // ISO 8601 — 15-min TTL
  used_at:    string | null;
  created_at: string;
}

// ── Build 013: ProjectSettings ────────────────────────────────────────────
// One row per project — canonical source of truth for all Platform Feature config.
// Supersedes scattered columns on `projects` and the `seo_settings` / `waitlist_highlights` tables.

// Embedded shape for project_settings.waitlist_highlights JSONB array
export interface WaitlistHighlightEmbed {
  icon:        string;
  title:       string;
  description: string;
}

export interface ProjectSettings {
  id:         string;
  project_id: string;

  // Test Mode (007)
  test_mode_enabled:    boolean;
  test_mode_pin_hash:   string | null;   // NEVER expose on client — Edge Function only
  test_mode_pin_set_at: string | null;

  // Onboarding Tour (008)
  tour_enabled:        boolean;
  tour_generated_at:   string | null;
  tour_last_edited_at: string | null;

  // What's New (009)
  whats_new_enabled: boolean;

  // SEO / AEO (010)
  seo_meta_title:       string | null;
  seo_meta_description: string | null;
  seo_og_title:         string | null;
  seo_og_description:   string | null;
  seo_og_image_url:     string | null;
  seo_keywords:         string[] | null;
  seo_robots_index:     boolean;          // true = index, false = noindex
  seo_sitemap_enabled:  boolean;
  aeo_llms_txt:         string | null;
  aeo_json_ld:          Record<string, unknown> | null;
  aeo_ai_description:   string | null;
  seo_generated_at:     string | null;
  seo_published_at:     string | null;   // cleared by DB trigger on content edits

  // Waitlist (011)
  waitlist_enabled:      boolean;
  waitlist_highlights:   WaitlistHighlightEmbed[] | null;  // JSONB; max 3 items
  waitlist_form_enabled: boolean;

  // Setup checklist (014)
  setup_step: number;   // 1–6; persisted "In Progress" step

  // Audit
  created_at: string;
  updated_at: string;
}

// Patchable fields — excludes fields written only by Edge Functions
export type ProjectSettingsPatch = Partial<Omit<ProjectSettings,
  | 'id' | 'project_id' | 'created_at' | 'updated_at'
  | 'test_mode_pin_hash'    // written by set-pin Edge Function only
  | 'test_mode_pin_set_at'  // set alongside pin_hash by Edge Function
  | 'seo_generated_at'      // set by generate-seo Edge Function only
  | 'seo_published_at'      // set by push-to-production Edge Function only
  | 'tour_generated_at'     // set by generate-tour Edge Function only
  | 'tour_last_edited_at'   // set when tour steps are manually edited
>>;

/** true when SEO has been generated but changes exist since last push */
export function seoIsUnpublished(s: ProjectSettings): boolean {
  if (!s.seo_generated_at) return false;
  if (!s.seo_published_at) return true;
  return new Date(s.updated_at) > new Date(s.seo_published_at);
}

/** true when tour steps were manually edited after the last AI generation */
export function tourIsStale(s: ProjectSettings): boolean {
  if (!s.tour_generated_at || !s.tour_last_edited_at) return false;
  return new Date(s.tour_last_edited_at) > new Date(s.tour_generated_at);
}

// ── Build 014: Human Tasks + Project Hub Stats ────────────────────────────

export type HumanTaskType =
  | 'run_migration'
  | 'push_code'
  | 'add_env_var'
  | 'confirm_deploy'
  | 'connect_github'
  | 'connect_netlify'
  | 'set_supabase_url'
  | 'other';

export type HumanTaskStatus   = 'pending' | 'done' | 'dismissed';
export type HumanTaskPriority = 'p0' | 'p1';

export interface HumanTask {
  id:              string;
  project_id:      string;
  title:           string;
  description:     string | null;
  task_type:       HumanTaskType;
  status:          HumanTaskStatus;
  priority:        HumanTaskPriority;
  created_at:      string;
  completed_at:    string | null;
  // Build 016 additions (nullable):
  feature_id:      string | null;
  feature_step_id: string | null;
}

export interface ProjectHubStats {
  project_id:               string;
  project_name:             string;
  phase:                    'alpha' | 'beta' | 'live';
  status:                   string;
  screen_count:             number;
  feature_count:            number;
  open_bug_count:           number;
  pending_cr_count:         number;
  deployment_count:         number;   // always 0 until Build 004 deployed
  pending_human_task_count: number;
  setup_step:               number;   // 1–6
}

// ── Build 015: Screens ────────────────────────────────────────────────────

export type ScreenType = 'page' | 'modal' | 'auth' | 'dashboard';

export const SCREEN_TYPE_COLORS: Record<ScreenType, string> = {
  page:      '#8e8e93',  // gray
  modal:     '#bf5af2',  // purple
  auth:      '#0a84ff',  // blue
  dashboard: '#30d158',  // green
};

export interface Screen {
  id:          string;
  project_id:  string;
  name:        string;
  route:       string | null;
  type:        ScreenType;
  description: string | null;
  sort_order:  number | null;
  created_at:  string;
  updated_at:  string;
  deleted_at:  string | null;
}

export interface ScreenSummary {
  id:            string;
  project_id:    string;
  name:          string;
  route:         string | null;
  type:          ScreenType;
  description:   string | null;
  sort_order:    number | null;
  created_at:    string;
  updated_at:    string;
  // Aggregated counts
  feature_count:    number;
  open_bug_count:   number;
  pending_cr_count: number;
}

// ── Build 016: Feature Workflow ───────────────────────────────────────────

export type FeatureStepStatus = 'pending' | 'active' | 'approved' | 'changes_requested';

// Step content shapes — vary by step number
export interface StepFile {
  name:       string;  // e.g. 'FeatureScreen.tsx'
  content:    string;  // full file content
  line_count: number;
}

export interface StepContent {
  1: { spec_text: string };
  2: { sql: string; migration_run: boolean };
  3: { files: StepFile[] };
  4: { github_pr_url: string | null; netlify_deploy_url: string | null };
  5: { test_notes: string | null; sign_off_by: string | null };
}

export interface FeatureStep {
  id:          string;
  feature_id:  string;
  step_number: 1 | 2 | 3 | 4 | 5;
  status:      FeatureStepStatus;
  content:     StepContent[keyof StepContent] | null;
  approved_at: string | null;
  approved_by: string | null;
  created_at:  string;
  updated_at:  string;
}

export interface FeatureIteration {
  id:               string;
  feature_step_id:  string;
  iteration_number: number;
  change_note:      string;
  created_at:       string;
}

export interface FeatureChatMessage {
  id:          string;
  feature_id:  string;
  step_number: 1 | 2 | 3 | 4 | 5;
  role:        'user' | 'assistant';
  content:     string;
  created_at:  string;
}

export const STEP_LABELS: Record<number, string> = {
  1: 'Design',
  2: 'Schema',
  3: 'Code',
  4: 'Deploy',
  5: 'QA',
};

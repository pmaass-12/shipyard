/**
 * AI Model constants — Build 063
 *
 * OpenRouter model strings, display names, and provider metadata.
 * Used by AdminScreen (model select) and edge function helpers (isAnthropicModel).
 */

export interface AIModel {
  displayName: string;
  model:       string;
  provider:    'anthropic' | 'openai' | 'google' | 'mistralai' | 'meta-llama';
  notes?:      string;
}

export const AI_MODELS: AIModel[] = [
  // Anthropic
  { displayName: 'Claude Opus 4 (recommended)', model: 'anthropic/claude-opus-4',   provider: 'anthropic' },
  { displayName: 'Claude Sonnet 4',             model: 'anthropic/claude-sonnet-4',  provider: 'anthropic' },
  { displayName: 'Claude Haiku 4',              model: 'anthropic/claude-haiku-4',   provider: 'anthropic' },
  // OpenAI
  { displayName: 'GPT-4o',      model: 'openai/gpt-4o',       provider: 'openai', notes: 'May diverge from Claude output style' },
  { displayName: 'GPT-4o mini', model: 'openai/gpt-4o-mini',  provider: 'openai', notes: 'Best for simple Q&A, not design generation' },
  // Google
  { displayName: 'Gemini 2.0 Flash', model: 'google/gemini-2.0-flash-001',          provider: 'google' },
  { displayName: 'Gemini 2.5 Pro',   model: 'google/gemini-2.5-pro-preview-03-25',  provider: 'google' },
  // Mistral
  { displayName: 'Mistral Large', model: 'mistralai/mistral-large-2411', provider: 'mistralai' },
  // Meta
  { displayName: 'Llama 4 Scout',    model: 'meta-llama/llama-4-scout',    provider: 'meta-llama', notes: 'Lowest cost tier' },
  { displayName: 'Llama 4 Maverick', model: 'meta-llama/llama-4-maverick', provider: 'meta-llama' },
];

export const DEFAULT_AI_MODEL = 'anthropic/claude-sonnet-4';

export function isAnthropicModel(model: string): boolean {
  return model.startsWith('anthropic/');
}

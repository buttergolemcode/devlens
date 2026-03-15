export type Provider = 'groq' | 'gemini' | 'openrouter' | 'openai' | 'anthropic' | 'custom'

export interface ProviderConfig {
  provider: Provider
  apiKey: string
  model: string
  customEndpoint?: string
}

export interface PageContext {
  type: PageType
  url: string
  title: string
  selectedText: string
  surroundingText: string
  codeLanguage?: string
}

export type PageType =
  | 'docs-mdn'
  | 'docs-generic'
  | 'stackoverflow'
  | 'github-code'
  | 'github-pr'
  | 'github-issue'
  | 'api-reference'
  | 'cloud-docs'
  | 'npm-pypi'
  | 'generic'

export interface ExplainRequest {
  action: 'explain' | 'improve' | 'convert'
  context: PageContext
  targetLanguage?: string
}

export interface ExplainResponse {
  explanation: string
  codeExample?: string
  watchOut?: string
  error?: string
}

export interface DevLensMessage {
  type: 'EXPLAIN_REQUEST' | 'EXPLAIN_RESPONSE' | 'CHECK_LICENSE' | 'LICENSE_RESULT' | 'GET_USAGE' | 'USAGE_RESULT'
  payload: unknown
}

export const PROVIDERS: Record<Provider, { name: string; models: { id: string; label: string }[]; corsOk: boolean }> = {
  groq: {
    name: 'Groq (Free Tier)',
    corsOk: true,
    models: [
      { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B' },
      { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B (faster)' },
    ],
  },
  gemini: {
    name: 'Google Gemini (Free Tier)',
    corsOk: true,
    models: [
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
      { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
    ],
  },
  openrouter: {
    name: 'OpenRouter',
    corsOk: true,
    models: [
      { id: 'anthropic/claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
      { id: 'openai/gpt-4o-mini', label: 'GPT-4o Mini' },
      { id: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
    ],
  },
  openai: {
    name: 'OpenAI',
    corsOk: false,
    models: [
      { id: 'gpt-4o-mini', label: 'GPT-4o Mini' },
      { id: 'gpt-4o', label: 'GPT-4o' },
    ],
  },
  anthropic: {
    name: 'Anthropic (Claude)',
    corsOk: false,
    models: [
      { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
      { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
    ],
  },
  custom: {
    name: 'Custom (OpenAI-compatible)',
    corsOk: true,
    models: [
      { id: 'custom', label: 'Custom Model' },
    ],
  },
}

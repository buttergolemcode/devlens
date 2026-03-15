import type { ProviderConfig } from './types'

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

async function callOpenAICompatible(
  endpoint: string,
  apiKey: string,
  model: string,
  prompt: string,
  extraHeaders?: Record<string, string>
): Promise<string> {
  const messages: ChatMessage[] = [{ role: 'user', content: prompt }]

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      ...extraHeaders,
    },
    body: JSON.stringify({ model, messages, max_tokens: 1024, temperature: 0.3 }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`API ${res.status}: ${body.slice(0, 200)}`)
  }

  const data = await res.json()
  return data.choices?.[0]?.message?.content ?? ''
}

async function callGemini(apiKey: string, model: string, prompt: string): Promise<string> {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 1024, temperature: 0.3 },
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Gemini ${res.status}: ${body.slice(0, 200)}`)
  }

  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
}

async function callAnthropic(apiKey: string, model: string, prompt: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1024,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Anthropic ${res.status}: ${body.slice(0, 200)}`)
  }

  const data = await res.json()
  return data.content?.[0]?.text ?? ''
}

export async function complete(config: ProviderConfig, prompt: string): Promise<string> {
  switch (config.provider) {
    case 'groq':
      return callOpenAICompatible(
        'https://api.groq.com/openai/v1/chat/completions',
        config.apiKey, config.model, prompt
      )

    case 'gemini':
      return callGemini(config.apiKey, config.model, prompt)

    case 'openrouter':
      return callOpenAICompatible(
        'https://openrouter.ai/api/v1/chat/completions',
        config.apiKey, config.model, prompt,
        { 'HTTP-Referer': 'https://devlens.dev', 'X-Title': 'DevLens' }
      )

    case 'openai':
      return callOpenAICompatible(
        'https://api.openai.com/v1/chat/completions',
        config.apiKey, config.model, prompt
      )

    case 'anthropic':
      return callAnthropic(config.apiKey, config.model, prompt)

    case 'custom':
      return callOpenAICompatible(
        config.customEndpoint ?? '', config.apiKey, config.model, prompt
      )

    default:
      throw new Error(`Unknown provider: ${config.provider}`)
  }
}

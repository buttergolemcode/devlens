import { complete } from '../lib/ai-providers'
import { loadProvider, canUse, incrementUsage } from '../lib/storage'
import { buildExplainPrompt, buildImprovePrompt, buildConvertPrompt } from '../lib/prompts'
import type { ExplainRequest, ExplainResponse, PageContext } from '../lib/types'

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'devlens-explain',
    title: 'Explain with DevLens',
    contexts: ['selection'],
  })

  chrome.contextMenus.create({
    id: 'devlens-improve',
    title: 'Improve this code',
    contexts: ['selection'],
  })
})

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id || !info.selectionText) return

  const action = info.menuItemId === 'devlens-improve' ? 'improve' : 'explain'

  chrome.tabs.sendMessage(tab.id, {
    type: 'TRIGGER_FROM_CONTEXT_MENU',
    action,
    selectedText: info.selectionText,
  })
})

chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'explain-selection') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, { type: 'TRIGGER_FROM_SHORTCUT' })
    }
  }
})

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'EXPLAIN_REQUEST') {
    handleExplainRequest(message.payload as ExplainRequest)
      .then(sendResponse)
      .catch((err) => sendResponse({ error: err.message } as ExplainResponse))
    return true
  }

  if (message.type === 'CHECK_USAGE') {
    canUse().then(sendResponse)
    return true
  }
})

async function handleExplainRequest(req: ExplainRequest): Promise<ExplainResponse> {
  const usage = await canUse()
  if (!usage.allowed) {
    return { explanation: '', error: `Daily free limit reached (${usage.remaining} remaining). Upgrade to Pro for unlimited.` }
  }

  const config = await loadProvider()
  if (!config || !config.apiKey) {
    return { explanation: '', error: 'No AI provider configured. Open DevLens settings to add your API key.' }
  }

  let prompt: string
  switch (req.action) {
    case 'improve':
      prompt = buildImprovePrompt(req.context)
      break
    case 'convert':
      prompt = buildConvertPrompt(req.context, req.targetLanguage ?? 'TypeScript')
      break
    default:
      prompt = buildExplainPrompt(req.context)
  }

  try {
    const result = await complete(config, prompt)
    await incrementUsage()

    return parseResponse(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { explanation: '', error: `AI request failed: ${msg}` }
  }
}

function parseResponse(raw: string): ExplainResponse {
  const explanation = raw
  return { explanation }
}

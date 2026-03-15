import { PROVIDERS, type Provider, type ProviderConfig } from '../lib/types'
import { saveProvider, loadProvider, getUsageToday, isPro, FREE_DAILY_LIMIT } from '../lib/storage'
import { complete } from '../lib/ai-providers'

const providerSelect = document.getElementById('provider') as HTMLSelectElement
const modelSelect = document.getElementById('model') as HTMLSelectElement
const apiKeyInput = document.getElementById('apiKey') as HTMLInputElement
const customEndpointWrapper = document.getElementById('customEndpointWrapper') as HTMLElement
const customEndpointInput = document.getElementById('customEndpoint') as HTMLInputElement
const saveBtn = document.getElementById('save') as HTMLButtonElement
const testBtn = document.getElementById('test') as HTMLButtonElement
const statusDiv = document.getElementById('status') as HTMLElement
const usageText = document.getElementById('usageText') as HTMLElement
const usageBar = document.getElementById('usageBar') as HTMLElement

function populateModels(provider: Provider) {
  const info = PROVIDERS[provider]
  modelSelect.innerHTML = info.models.map(m =>
    `<option value="${m.id}">${m.label}</option>`
  ).join('')

  customEndpointWrapper.classList.toggle('visible', provider === 'custom')
}

function showStatus(msg: string, type: 'success' | 'error') {
  statusDiv.textContent = msg
  statusDiv.className = `status ${type}`
  statusDiv.style.display = 'block'
  setTimeout(() => { statusDiv.style.display = 'none' }, 4000)
}

function getConfig(): ProviderConfig {
  return {
    provider: providerSelect.value as Provider,
    model: modelSelect.value,
    apiKey: apiKeyInput.value.trim(),
    customEndpoint: customEndpointInput.value.trim() || undefined,
  }
}

providerSelect.addEventListener('change', () => {
  populateModels(providerSelect.value as Provider)
})

saveBtn.addEventListener('click', async () => {
  const config = getConfig()
  if (!config.apiKey) {
    showStatus('Please enter an API key.', 'error')
    return
  }
  await saveProvider(config)
  showStatus('Settings saved!', 'success')
})

testBtn.addEventListener('click', async () => {
  const config = getConfig()
  if (!config.apiKey) {
    showStatus('Please enter an API key first.', 'error')
    return
  }

  testBtn.disabled = true
  testBtn.textContent = 'Testing...'

  try {
    const result = await complete(config, 'Respond with exactly: "DevLens connected successfully." Nothing else.')
    if (result.toLowerCase().includes('devlens')) {
      showStatus(`Connection successful! Model: ${config.model}`, 'success')
    } else {
      showStatus(`Connected, but unexpected response. Model may need adjustment.`, 'success')
    }
  } catch (err) {
    showStatus(`Connection failed: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error')
  } finally {
    testBtn.disabled = false
    testBtn.textContent = 'Test Connection'
  }
})

async function updateUsage() {
  const pro = await isPro()
  const used = await getUsageToday()

  if (pro) {
    usageText.textContent = '✨ Pro — Unlimited'
    usageBar.style.width = '0%'
  } else {
    usageText.textContent = `${used} / ${FREE_DAILY_LIMIT} free explanations used today`
    usageBar.style.width = `${Math.min(100, (used / FREE_DAILY_LIMIT) * 100)}%`
  }
}

async function init() {
  populateModels('groq')

  const saved = await loadProvider()
  if (saved) {
    providerSelect.value = saved.provider
    populateModels(saved.provider)
    modelSelect.value = saved.model
    apiKeyInput.value = saved.apiKey
    if (saved.customEndpoint) {
      customEndpointInput.value = saved.customEndpoint
    }
  }

  await updateUsage()
}

init()

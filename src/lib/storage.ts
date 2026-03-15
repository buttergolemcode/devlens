import type { ProviderConfig } from './types'

const KEYS = {
  PROVIDER: 'devlens_provider',
  USAGE_TODAY: 'devlens_usage_today',
  USAGE_DATE: 'devlens_usage_date',
  LICENSE: 'devlens_license',
  IS_PRO: 'devlens_is_pro',
} as const

const FREE_DAILY_LIMIT = 10

function getStorage(): typeof chrome.storage.local | null {
  if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
    return chrome.storage.local
  }
  return null
}

export async function saveProvider(config: ProviderConfig): Promise<void> {
  const storage = getStorage()
  if (storage) {
    await storage.set({ [KEYS.PROVIDER]: config })
  } else {
    localStorage.setItem(KEYS.PROVIDER, JSON.stringify(config))
  }
}

export async function loadProvider(): Promise<ProviderConfig | null> {
  const storage = getStorage()
  if (storage) {
    const result = await storage.get(KEYS.PROVIDER)
    return result[KEYS.PROVIDER] ?? null
  }
  const raw = localStorage.getItem(KEYS.PROVIDER)
  return raw ? JSON.parse(raw) : null
}

export async function getUsageToday(): Promise<number> {
  const storage = getStorage()
  const today = new Date().toISOString().slice(0, 10)

  if (storage) {
    const result = await storage.get([KEYS.USAGE_TODAY, KEYS.USAGE_DATE])
    if (result[KEYS.USAGE_DATE] !== today) return 0
    return result[KEYS.USAGE_TODAY] ?? 0
  }

  if (localStorage.getItem(KEYS.USAGE_DATE) !== today) return 0
  return parseInt(localStorage.getItem(KEYS.USAGE_TODAY) ?? '0', 10)
}

export async function incrementUsage(): Promise<number> {
  const today = new Date().toISOString().slice(0, 10)
  const storage = getStorage()

  if (storage) {
    const result = await storage.get([KEYS.USAGE_TODAY, KEYS.USAGE_DATE])
    const count = result[KEYS.USAGE_DATE] === today ? (result[KEYS.USAGE_TODAY] ?? 0) + 1 : 1
    await storage.set({ [KEYS.USAGE_TODAY]: count, [KEYS.USAGE_DATE]: today })
    return count
  }

  const storedDate = localStorage.getItem(KEYS.USAGE_DATE)
  const current = storedDate === today ? parseInt(localStorage.getItem(KEYS.USAGE_TODAY) ?? '0', 10) : 0
  const next = current + 1
  localStorage.setItem(KEYS.USAGE_TODAY, String(next))
  localStorage.setItem(KEYS.USAGE_DATE, today)
  return next
}

export async function isPro(): Promise<boolean> {
  const storage = getStorage()
  if (storage) {
    const result = await storage.get(KEYS.IS_PRO)
    return result[KEYS.IS_PRO] === true
  }
  return localStorage.getItem(KEYS.IS_PRO) === 'true'
}

export async function canUse(): Promise<{ allowed: boolean; remaining: number; isPro: boolean }> {
  const pro = await isPro()
  if (pro) return { allowed: true, remaining: Infinity, isPro: true }

  const used = await getUsageToday()
  const remaining = Math.max(0, FREE_DAILY_LIMIT - used)
  return { allowed: remaining > 0, remaining, isPro: false }
}

export { FREE_DAILY_LIMIT }

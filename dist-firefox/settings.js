// src/lib/types.ts
var PROVIDERS = {
  groq: {
    name: "Groq (Free Tier)",
    corsOk: true,
    models: [
      { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B" },
      { id: "llama-3.1-8b-instant", label: "Llama 3.1 8B (faster)" }
    ]
  },
  gemini: {
    name: "Google Gemini (Free Tier)",
    corsOk: true,
    models: [
      { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
      { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash" }
    ]
  },
  openrouter: {
    name: "OpenRouter",
    corsOk: true,
    models: [
      { id: "anthropic/claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
      { id: "openai/gpt-4o-mini", label: "GPT-4o Mini" },
      { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash" }
    ]
  },
  openai: {
    name: "OpenAI",
    corsOk: false,
    models: [
      { id: "gpt-4o-mini", label: "GPT-4o Mini" },
      { id: "gpt-4o", label: "GPT-4o" }
    ]
  },
  anthropic: {
    name: "Anthropic (Claude)",
    corsOk: false,
    models: [
      { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
      { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" }
    ]
  },
  custom: {
    name: "Custom (OpenAI-compatible)",
    corsOk: true,
    models: [
      { id: "custom", label: "Custom Model" }
    ]
  }
};

// src/lib/storage.ts
var KEYS = {
  PROVIDER: "devlens_provider",
  USAGE_TODAY: "devlens_usage_today",
  USAGE_DATE: "devlens_usage_date",
  LICENSE: "devlens_license",
  IS_PRO: "devlens_is_pro"
};
var FREE_DAILY_LIMIT = 10;
function getStorage() {
  if (typeof chrome !== "undefined" && chrome?.storage?.local) {
    return chrome.storage.local;
  }
  return null;
}
async function saveProvider(config) {
  const storage = getStorage();
  if (storage) {
    await storage.set({ [KEYS.PROVIDER]: config });
  } else {
    localStorage.setItem(KEYS.PROVIDER, JSON.stringify(config));
  }
}
async function loadProvider() {
  const storage = getStorage();
  if (storage) {
    const result = await storage.get(KEYS.PROVIDER);
    return result[KEYS.PROVIDER] ?? null;
  }
  const raw = localStorage.getItem(KEYS.PROVIDER);
  return raw ? JSON.parse(raw) : null;
}
async function getUsageToday() {
  const storage = getStorage();
  const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  if (storage) {
    const result = await storage.get([KEYS.USAGE_TODAY, KEYS.USAGE_DATE]);
    if (result[KEYS.USAGE_DATE] !== today) return 0;
    return result[KEYS.USAGE_TODAY] ?? 0;
  }
  if (localStorage.getItem(KEYS.USAGE_DATE) !== today) return 0;
  return parseInt(localStorage.getItem(KEYS.USAGE_TODAY) ?? "0", 10);
}
async function isPro() {
  const storage = getStorage();
  if (storage) {
    const result = await storage.get(KEYS.IS_PRO);
    return result[KEYS.IS_PRO] === true;
  }
  return localStorage.getItem(KEYS.IS_PRO) === "true";
}

// src/lib/ai-providers.ts
async function callOpenAICompatible(endpoint, apiKey, model, prompt, extraHeaders) {
  const messages = [{ role: "user", content: prompt }];
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
      ...extraHeaders
    },
    body: JSON.stringify({ model, messages, max_tokens: 1024, temperature: 0.3 })
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}
async function callGemini(apiKey, model, prompt) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 1024, temperature: 0.3 }
    })
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}
async function callAnthropic(apiKey, model, prompt) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1024
    })
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.content?.[0]?.text ?? "";
}
async function complete(config, prompt) {
  switch (config.provider) {
    case "groq":
      return callOpenAICompatible(
        "https://api.groq.com/openai/v1/chat/completions",
        config.apiKey,
        config.model,
        prompt
      );
    case "gemini":
      return callGemini(config.apiKey, config.model, prompt);
    case "openrouter":
      return callOpenAICompatible(
        "https://openrouter.ai/api/v1/chat/completions",
        config.apiKey,
        config.model,
        prompt,
        { "HTTP-Referer": "https://devlens.dev", "X-Title": "DevLens" }
      );
    case "openai":
      return callOpenAICompatible(
        "https://api.openai.com/v1/chat/completions",
        config.apiKey,
        config.model,
        prompt
      );
    case "anthropic":
      return callAnthropic(config.apiKey, config.model, prompt);
    case "custom":
      return callOpenAICompatible(
        config.customEndpoint ?? "",
        config.apiKey,
        config.model,
        prompt
      );
    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }
}

// src/settings/settings.ts
var providerSelect = document.getElementById("provider");
var modelSelect = document.getElementById("model");
var apiKeyInput = document.getElementById("apiKey");
var customEndpointWrapper = document.getElementById("customEndpointWrapper");
var customEndpointInput = document.getElementById("customEndpoint");
var saveBtn = document.getElementById("save");
var testBtn = document.getElementById("test");
var statusDiv = document.getElementById("status");
var usageText = document.getElementById("usageText");
var usageBar = document.getElementById("usageBar");
function populateModels(provider) {
  const info = PROVIDERS[provider];
  modelSelect.innerHTML = info.models.map(
    (m) => `<option value="${m.id}">${m.label}</option>`
  ).join("");
  customEndpointWrapper.classList.toggle("visible", provider === "custom");
}
function showStatus(msg, type) {
  statusDiv.textContent = msg;
  statusDiv.className = `status ${type}`;
  statusDiv.style.display = "block";
  setTimeout(() => {
    statusDiv.style.display = "none";
  }, 4e3);
}
function getConfig() {
  return {
    provider: providerSelect.value,
    model: modelSelect.value,
    apiKey: apiKeyInput.value.trim(),
    customEndpoint: customEndpointInput.value.trim() || void 0
  };
}
providerSelect.addEventListener("change", () => {
  populateModels(providerSelect.value);
});
saveBtn.addEventListener("click", async () => {
  const config = getConfig();
  if (!config.apiKey) {
    showStatus("Please enter an API key.", "error");
    return;
  }
  await saveProvider(config);
  showStatus("Settings saved!", "success");
});
testBtn.addEventListener("click", async () => {
  const config = getConfig();
  if (!config.apiKey) {
    showStatus("Please enter an API key first.", "error");
    return;
  }
  testBtn.disabled = true;
  testBtn.textContent = "Testing...";
  try {
    const result = await complete(config, 'Respond with exactly: "DevLens connected successfully." Nothing else.');
    if (result.toLowerCase().includes("devlens")) {
      showStatus(`Connection successful! Model: ${config.model}`, "success");
    } else {
      showStatus(`Connected, but unexpected response. Model may need adjustment.`, "success");
    }
  } catch (err) {
    showStatus(`Connection failed: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
  } finally {
    testBtn.disabled = false;
    testBtn.textContent = "Test Connection";
  }
});
async function updateUsage() {
  const pro = await isPro();
  const used = await getUsageToday();
  if (pro) {
    usageText.textContent = "\u2728 Pro \u2014 Unlimited";
    usageBar.style.width = "0%";
  } else {
    usageText.textContent = `${used} / ${FREE_DAILY_LIMIT} free explanations used today`;
    usageBar.style.width = `${Math.min(100, used / FREE_DAILY_LIMIT * 100)}%`;
  }
}
async function init() {
  populateModels("groq");
  const saved = await loadProvider();
  if (saved) {
    providerSelect.value = saved.provider;
    populateModels(saved.provider);
    modelSelect.value = saved.model;
    apiKeyInput.value = saved.apiKey;
    if (saved.customEndpoint) {
      customEndpointInput.value = saved.customEndpoint;
    }
  }
  await updateUsage();
}
init();

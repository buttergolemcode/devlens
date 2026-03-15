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
async function incrementUsage() {
  const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const storage = getStorage();
  if (storage) {
    const result = await storage.get([KEYS.USAGE_TODAY, KEYS.USAGE_DATE]);
    const count = result[KEYS.USAGE_DATE] === today ? (result[KEYS.USAGE_TODAY] ?? 0) + 1 : 1;
    await storage.set({ [KEYS.USAGE_TODAY]: count, [KEYS.USAGE_DATE]: today });
    return count;
  }
  const storedDate = localStorage.getItem(KEYS.USAGE_DATE);
  const current = storedDate === today ? parseInt(localStorage.getItem(KEYS.USAGE_TODAY) ?? "0", 10) : 0;
  const next = current + 1;
  localStorage.setItem(KEYS.USAGE_TODAY, String(next));
  localStorage.setItem(KEYS.USAGE_DATE, today);
  return next;
}
async function isPro() {
  const storage = getStorage();
  if (storage) {
    const result = await storage.get(KEYS.IS_PRO);
    return result[KEYS.IS_PRO] === true;
  }
  return localStorage.getItem(KEYS.IS_PRO) === "true";
}
async function canUse() {
  const pro = await isPro();
  if (pro) return { allowed: true, remaining: Infinity, isPro: true };
  const used = await getUsageToday();
  const remaining = Math.max(0, FREE_DAILY_LIMIT - used);
  return { allowed: remaining > 0, remaining, isPro: false };
}

// src/lib/page-detector.ts
function getPageTypeLabel(type) {
  const labels = {
    "docs-mdn": "MDN Web Docs",
    "docs-generic": "Documentation",
    "stackoverflow": "Stack Overflow",
    "github-code": "GitHub Code",
    "github-pr": "GitHub Pull Request",
    "github-issue": "GitHub Issue",
    "api-reference": "API Reference",
    "cloud-docs": "Cloud Documentation",
    "npm-pypi": "Package Registry",
    "generic": "Web Page"
  };
  return labels[type];
}

// src/lib/prompts.ts
var PAGE_INSTRUCTIONS = {
  "docs-mdn": "Focus on web standards. Mention browser compatibility if relevant. Use JavaScript/TypeScript examples.",
  "docs-generic": "Explain the concept in the context of this framework/library. Give practical, working examples.",
  "stackoverflow": "Synthesize the best answer. Flag if the top answer is outdated. Suggest modern alternatives if applicable.",
  "github-code": "Explain what this code does step-by-step. Note any patterns, potential issues, or improvements.",
  "github-pr": "Focus on what this change does, why it might have been made, and any potential issues to watch for.",
  "github-issue": "Summarize the issue and any proposed solutions. Highlight the most actionable suggestion.",
  "api-reference": "Explain this endpoint/method. Generate a working request example (curl or fetch). Show expected response structure.",
  "cloud-docs": "Explain in practical terms. Focus on common use cases and gotchas. Mention cost implications if relevant.",
  "npm-pypi": "Summarize what this package does. Note alternatives, maintenance status, and common usage patterns.",
  "generic": "Explain clearly for a developer audience."
};
function buildExplainPrompt(ctx) {
  const pageLabel = getPageTypeLabel(ctx.type);
  const pageInstructions = PAGE_INSTRUCTIONS[ctx.type];
  return `You are DevLens, an AI developer assistant embedded in the user's browser. You help developers understand technical content instantly.

CONTEXT:
- Page type: ${pageLabel}
- Page: ${ctx.title}
- URL: ${ctx.url}
${pageInstructions}

The user highlighted this text:
"""
${ctx.selectedText}
"""

Surrounding context on the page:
"""
${ctx.surroundingText}
"""

Respond in this exact format:

**Explanation**
[2-3 sentences explaining the concept in plain English. Assume intermediate developer knowledge.]

**Example**
\`\`\`${ctx.codeLanguage || "javascript"}
[A minimal, working code example demonstrating this concept]
\`\`\`

**\u26A0\uFE0F Watch Out**
[1 common mistake or gotcha related to this concept]

Rules:
- Keep total response under 200 words
- Code examples must be working and minimal
- Never say "as an AI" or "I'm happy to help"
- Be direct and concise`;
}
function buildImprovePrompt(ctx) {
  return `You are DevLens, a code improvement assistant.

The user selected this code on ${getPageTypeLabel(ctx.type)}:
\`\`\`
${ctx.selectedText}
\`\`\`

Page: ${ctx.title} (${ctx.url})

Suggest improvements in this exact format:

**Issues Found**
[Bullet list of problems: bugs, performance, security, readability]

**Improved Version**
\`\`\`${ctx.codeLanguage || "javascript"}
[The improved code]
\`\`\`

**What Changed**
[Brief explanation of each change]

Be concise. Under 250 words total.`;
}
function buildConvertPrompt(ctx, targetLang) {
  return `Convert this code to ${targetLang}. Keep it idiomatic for ${targetLang}.

Original:
\`\`\`
${ctx.selectedText}
\`\`\`

Respond with ONLY the converted code in a code block, followed by 1-2 sentences noting any important differences between the languages for this specific conversion.`;
}

// src/background/service-worker.ts
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "devlens-explain",
    title: "Explain with DevLens",
    contexts: ["selection"]
  });
  chrome.contextMenus.create({
    id: "devlens-improve",
    title: "Improve this code",
    contexts: ["selection"]
  });
});
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id || !info.selectionText) return;
  const action = info.menuItemId === "devlens-improve" ? "improve" : "explain";
  chrome.tabs.sendMessage(tab.id, {
    type: "TRIGGER_FROM_CONTEXT_MENU",
    action,
    selectedText: info.selectionText
  });
});
chrome.commands.onCommand.addListener(async (command) => {
  if (command === "explain-selection") {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, { type: "TRIGGER_FROM_SHORTCUT" });
    }
  }
});
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "EXPLAIN_REQUEST") {
    handleExplainRequest(message.payload).then(sendResponse).catch((err) => sendResponse({ error: err.message }));
    return true;
  }
  if (message.type === "CHECK_USAGE") {
    canUse().then(sendResponse);
    return true;
  }
});
async function handleExplainRequest(req) {
  const usage = await canUse();
  if (!usage.allowed) {
    return { explanation: "", error: `Daily free limit reached (${usage.remaining} remaining). Upgrade to Pro for unlimited.` };
  }
  const config = await loadProvider();
  if (!config || !config.apiKey) {
    return { explanation: "", error: "No AI provider configured. Open DevLens settings to add your API key." };
  }
  let prompt;
  switch (req.action) {
    case "improve":
      prompt = buildImprovePrompt(req.context);
      break;
    case "convert":
      prompt = buildConvertPrompt(req.context, req.targetLanguage ?? "TypeScript");
      break;
    default:
      prompt = buildExplainPrompt(req.context);
  }
  try {
    const result = await complete(config, prompt);
    await incrementUsage();
    return parseResponse(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { explanation: "", error: `AI request failed: ${msg}` };
  }
}
function parseResponse(raw) {
  const explanation = raw;
  return { explanation };
}

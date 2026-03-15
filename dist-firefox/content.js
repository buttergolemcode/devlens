// src/lib/page-detector.ts
var PAGE_RULES = [
  { test: (u) => u.includes("developer.mozilla.org"), type: "docs-mdn" },
  { test: (u) => u.includes("stackoverflow.com") || u.includes("stackexchange.com"), type: "stackoverflow" },
  { test: (u) => u.includes("github.com") && (u.includes("/pull/") || u.includes("/pulls")), type: "github-pr" },
  { test: (u) => u.includes("github.com") && u.includes("/issues"), type: "github-issue" },
  { test: (u) => u.includes("github.com"), type: "github-code" },
  { test: (u) => u.includes("npmjs.com") || u.includes("pypi.org") || u.includes("crates.io"), type: "npm-pypi" },
  { test: (u) => u.includes("console.aws") || u.includes("cloud.google") || u.includes("portal.azure") || u.includes("docs.aws"), type: "cloud-docs" },
  { test: (u) => /\/api[-/]|\/reference\//i.test(u) || u.includes("swagger") || u.includes("redoc"), type: "api-reference" },
  { test: (u) => /\/docs[\/.]|\/documentation[\/.]|\/guide[\/.]|\/tutorial[\/.]|\/learn[\/.]/.test(u), type: "docs-generic" }
];
function detectPageType(url) {
  for (const rule of PAGE_RULES) {
    if (rule.test(url)) return rule.type;
  }
  return "generic";
}

// src/content/content-script.ts
var activePopup = null;
function getSelectedTextContext() {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) return null;
  const selectedText = selection.toString().trim();
  if (!selectedText || selectedText.length < 3) return null;
  const range = selection.getRangeAt(0);
  const container = range.commonAncestorContainer;
  let surroundingText = "";
  const parentEl = container.nodeType === Node.TEXT_NODE ? container.parentElement : container;
  if (parentEl) {
    const fullText = parentEl.textContent ?? "";
    const startIdx = Math.max(0, fullText.indexOf(selectedText) - 200);
    const endIdx = Math.min(fullText.length, fullText.indexOf(selectedText) + selectedText.length + 200);
    surroundingText = fullText.slice(startIdx, endIdx);
  }
  const codeEl = parentEl?.closest("code, pre");
  const codeLanguage = codeEl?.className?.match(/language-(\w+)/)?.[1];
  return {
    type: detectPageType(window.location.href),
    url: window.location.href,
    title: document.title,
    selectedText,
    surroundingText,
    codeLanguage: codeLanguage ?? void 0
  };
}
function getPopupPosition(selection) {
  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  let x = rect.left + window.scrollX;
  let y = rect.bottom + window.scrollY + 8;
  if (x + 420 > window.innerWidth + window.scrollX) {
    x = window.innerWidth + window.scrollX - 430;
  }
  if (x < 10) x = 10;
  return { x, y };
}
function removePopup() {
  if (activePopup) {
    activePopup.remove();
    activePopup = null;
  }
}
function createPopup(x, y) {
  removePopup();
  const popup = document.createElement("div");
  popup.id = "devlens-popup";
  popup.innerHTML = `
    <div class="devlens-header">
      <span class="devlens-logo">\u2B21 DevLens</span>
      <div class="devlens-header-actions">
        <button class="devlens-btn-icon" id="devlens-copy" title="Copy">\u{1F4CB}</button>
        <button class="devlens-btn-icon" id="devlens-close" title="Close">\u2715</button>
      </div>
    </div>
    <div class="devlens-body">
      <div class="devlens-loading">
        <div class="devlens-spinner"></div>
        <span>Thinking...</span>
      </div>
    </div>
  `;
  popup.style.left = `${x}px`;
  popup.style.top = `${y}px`;
  document.body.appendChild(popup);
  activePopup = popup;
  popup.querySelector("#devlens-close")?.addEventListener("click", removePopup);
  popup.querySelector("#devlens-copy")?.addEventListener("click", () => {
    const body = popup.querySelector(".devlens-body");
    if (body) {
      navigator.clipboard.writeText(body.textContent ?? "");
      const btn = popup.querySelector("#devlens-copy");
      if (btn) {
        btn.textContent = "\u2713";
        setTimeout(() => {
          btn.textContent = "\u{1F4CB}";
        }, 1500);
      }
    }
  });
  return popup;
}
function renderResponse(popup, response) {
  const body = popup.querySelector(".devlens-body");
  if (!body) return;
  if (response.error) {
    body.innerHTML = `<div class="devlens-error">${escapeHtml(response.error)}</div>`;
    return;
  }
  body.innerHTML = formatMarkdown(response.explanation);
}
function formatMarkdown(md) {
  let html = escapeHtml(md);
  html = html.replace(/\*\*⚠️ Watch Out\*\*/g, '<div class="devlens-watchout"><strong>\u26A0\uFE0F Watch Out</strong></div>');
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, lang, code) => {
    return `<pre class="devlens-code"><code class="language-${lang}">${code.trim()}</code></pre>`;
  });
  html = html.replace(/`([^`]+)`/g, '<code class="devlens-inline-code">$1</code>');
  html = html.replace(/\n\n/g, "</p><p>");
  html = html.replace(/\n/g, "<br>");
  html = `<p>${html}</p>`;
  return html;
}
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
async function triggerExplain(action = "explain") {
  const ctx = getSelectedTextContext();
  if (!ctx) return;
  const selection = window.getSelection();
  if (!selection) return;
  const pos = getPopupPosition(selection);
  const popup = createPopup(pos.x, pos.y);
  try {
    const response = await chrome.runtime.sendMessage({
      type: "EXPLAIN_REQUEST",
      payload: { action, context: ctx }
    });
    renderResponse(popup, response);
  } catch (err) {
    renderResponse(popup, {
      explanation: "",
      error: err instanceof Error ? err.message : "Failed to get response"
    });
  }
}
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "TRIGGER_FROM_SHORTCUT") {
    triggerExplain("explain");
  }
  if (message.type === "TRIGGER_FROM_CONTEXT_MENU") {
    triggerExplain(message.action ?? "explain");
  }
});
function injectCodeBlockButtons() {
  const codeBlocks = document.querySelectorAll("pre:not([data-devlens])");
  codeBlocks.forEach((block) => {
    const code = block.querySelector("code") ?? block;
    const text = code.textContent?.trim() ?? "";
    if (text.length < 20 || text.split("\n").length < 2) return;
    block.setAttribute("data-devlens", "true");
    block.style.position = "relative";
    const toolbar = document.createElement("div");
    toolbar.className = "devlens-code-toolbar";
    toolbar.innerHTML = `
      <button class="devlens-code-btn" data-action="explain" title="Explain this code">\u{1F4A1}</button>
      <button class="devlens-code-btn" data-action="improve" title="Improve this code">\u{1F527}</button>
      <button class="devlens-code-btn" data-action="copy" title="Copy code">\u{1F4CB}</button>
    `;
    toolbar.querySelectorAll(".devlens-code-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        if (action === "copy") {
          navigator.clipboard.writeText(text);
          btn.textContent = "\u2713";
          setTimeout(() => {
            btn.textContent = "\u{1F4CB}";
          }, 1500);
          return;
        }
        const rect = block.getBoundingClientRect();
        const popup = createPopup(
          rect.left + window.scrollX,
          rect.bottom + window.scrollY + 8
        );
        const lang = code.className?.match(/language-(\w+)/)?.[1];
        const ctx = {
          type: detectPageType(window.location.href),
          url: window.location.href,
          title: document.title,
          selectedText: text,
          surroundingText: "",
          codeLanguage: lang ?? void 0
        };
        chrome.runtime.sendMessage({
          type: "EXPLAIN_REQUEST",
          payload: { action, context: ctx }
        }).then((response) => {
          renderResponse(popup, response);
        }).catch((err) => {
          renderResponse(popup, { explanation: "", error: err.message });
        });
      });
    });
    block.appendChild(toolbar);
  });
}
var observer = new MutationObserver(() => {
  injectCodeBlockButtons();
});
observer.observe(document.body, { childList: true, subtree: true });
document.addEventListener("DOMContentLoaded", injectCodeBlockButtons);
if (document.readyState !== "loading") injectCodeBlockButtons();
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") removePopup();
});
document.addEventListener("click", (e) => {
  if (activePopup && !e.target.closest("#devlens-popup")) {
    removePopup();
  }
});

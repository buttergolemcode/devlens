import type { PageContext, PageType } from './types'
import { getPageTypeLabel } from './page-detector'

const PAGE_INSTRUCTIONS: Record<PageType, string> = {
  'docs-mdn': 'Focus on web standards. Mention browser compatibility if relevant. Use JavaScript/TypeScript examples.',
  'docs-generic': 'Explain the concept in the context of this framework/library. Give practical, working examples.',
  'stackoverflow': 'Synthesize the best answer. Flag if the top answer is outdated. Suggest modern alternatives if applicable.',
  'github-code': 'Explain what this code does step-by-step. Note any patterns, potential issues, or improvements.',
  'github-pr': 'Focus on what this change does, why it might have been made, and any potential issues to watch for.',
  'github-issue': 'Summarize the issue and any proposed solutions. Highlight the most actionable suggestion.',
  'api-reference': 'Explain this endpoint/method. Generate a working request example (curl or fetch). Show expected response structure.',
  'cloud-docs': 'Explain in practical terms. Focus on common use cases and gotchas. Mention cost implications if relevant.',
  'npm-pypi': 'Summarize what this package does. Note alternatives, maintenance status, and common usage patterns.',
  'generic': 'Explain clearly for a developer audience.',
}

export function buildExplainPrompt(ctx: PageContext): string {
  const pageLabel = getPageTypeLabel(ctx.type)
  const pageInstructions = PAGE_INSTRUCTIONS[ctx.type]

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
\`\`\`${ctx.codeLanguage || 'javascript'}
[A minimal, working code example demonstrating this concept]
\`\`\`

**⚠️ Watch Out**
[1 common mistake or gotcha related to this concept]

Rules:
- Keep total response under 200 words
- Code examples must be working and minimal
- Never say "as an AI" or "I'm happy to help"
- Be direct and concise`
}

export function buildImprovePrompt(ctx: PageContext): string {
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
\`\`\`${ctx.codeLanguage || 'javascript'}
[The improved code]
\`\`\`

**What Changed**
[Brief explanation of each change]

Be concise. Under 250 words total.`
}

export function buildConvertPrompt(ctx: PageContext, targetLang: string): string {
  return `Convert this code to ${targetLang}. Keep it idiomatic for ${targetLang}.

Original:
\`\`\`
${ctx.selectedText}
\`\`\`

Respond with ONLY the converted code in a code block, followed by 1-2 sentences noting any important differences between the languages for this specific conversion.`
}

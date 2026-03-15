import type { PageType } from './types'

const PAGE_RULES: Array<{ test: (url: string) => boolean; type: PageType }> = [
  { test: (u) => u.includes('developer.mozilla.org'), type: 'docs-mdn' },
  { test: (u) => u.includes('stackoverflow.com') || u.includes('stackexchange.com'), type: 'stackoverflow' },
  { test: (u) => u.includes('github.com') && (u.includes('/pull/') || u.includes('/pulls')), type: 'github-pr' },
  { test: (u) => u.includes('github.com') && u.includes('/issues'), type: 'github-issue' },
  { test: (u) => u.includes('github.com'), type: 'github-code' },
  { test: (u) => u.includes('npmjs.com') || u.includes('pypi.org') || u.includes('crates.io'), type: 'npm-pypi' },
  { test: (u) => u.includes('console.aws') || u.includes('cloud.google') || u.includes('portal.azure') || u.includes('docs.aws'), type: 'cloud-docs' },
  { test: (u) => /\/api[-/]|\/reference\//i.test(u) || u.includes('swagger') || u.includes('redoc'), type: 'api-reference' },
  { test: (u) => /\/docs[\/.]|\/documentation[\/.]|\/guide[\/.]|\/tutorial[\/.]|\/learn[\/.]/.test(u), type: 'docs-generic' },
]

export function detectPageType(url: string): PageType {
  for (const rule of PAGE_RULES) {
    if (rule.test(url)) return rule.type
  }
  return 'generic'
}

export function getPageTypeLabel(type: PageType): string {
  const labels: Record<PageType, string> = {
    'docs-mdn': 'MDN Web Docs',
    'docs-generic': 'Documentation',
    'stackoverflow': 'Stack Overflow',
    'github-code': 'GitHub Code',
    'github-pr': 'GitHub Pull Request',
    'github-issue': 'GitHub Issue',
    'api-reference': 'API Reference',
    'cloud-docs': 'Cloud Documentation',
    'npm-pypi': 'Package Registry',
    'generic': 'Web Page',
  }
  return labels[type]
}

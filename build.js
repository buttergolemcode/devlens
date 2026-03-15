import { build } from 'esbuild'
import { cpSync, mkdirSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dist = resolve(__dirname, 'dist')

// Clean and create dist
if (existsSync(dist)) {
  // Remove contents but keep dir
  const { rmSync } = await import('fs')
  rmSync(dist, { recursive: true, force: true })
}
mkdirSync(dist, { recursive: true })

// Bundle TypeScript entry points
const entries = [
  { in: 'src/background/service-worker.ts', out: 'background' },
  { in: 'src/content/content-script.ts', out: 'content' },
  { in: 'src/settings/settings.ts', out: 'settings' },
]

for (const entry of entries) {
  await build({
    entryPoints: [resolve(__dirname, entry.in)],
    outfile: resolve(dist, `${entry.out}.js`),
    bundle: true,
    format: 'esm',
    target: 'es2022',
    minify: false,
    sourcemap: false,
  })
  console.log(`✓ ${entry.out}.js`)
}

// Copy static files
const staticFiles = [
  ['manifest.json', 'manifest.json'],
  ['settings.html', 'settings.html'],
  ['sidepanel.html', 'sidepanel.html'],
  ['src/content/content.css', 'content.css'],
]

for (const [src, dest] of staticFiles) {
  cpSync(resolve(__dirname, src), resolve(dist, dest))
  console.log(`✓ ${dest}`)
}

// Copy icons
cpSync(resolve(__dirname, 'icons'), resolve(dist, 'icons'), { recursive: true })
console.log('✓ icons/')

console.log('\n✅ Build complete! Load dist/ as unpacked extension in Chrome.')

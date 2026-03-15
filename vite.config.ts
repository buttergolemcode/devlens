import { defineConfig } from 'vite'
import { resolve } from 'path'
import { copyFileSync, mkdirSync, existsSync, readdirSync } from 'fs'

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        background: resolve(__dirname, 'src/background/service-worker.ts'),
        content: resolve(__dirname, 'src/content/content-script.ts'),
        settings: resolve(__dirname, 'src/settings/settings.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        assetFileNames: '[name].[ext]',
        codeSplitting: false,
      },
    },
    target: 'es2022',
    minify: false,
    cssCodeSplit: false,
  },
  plugins: [
    {
      name: 'copy-extension-files',
      closeBundle() {
        const distDir = resolve(__dirname, 'dist')
        if (!existsSync(distDir)) mkdirSync(distDir, { recursive: true })

        for (const file of ['manifest.json', 'settings.html', 'sidepanel.html']) {
          const src = resolve(__dirname, file)
          if (existsSync(src)) copyFileSync(src, resolve(distDir, file))
        }

        const cssSource = resolve(__dirname, 'src/content/content.css')
        if (existsSync(cssSource)) copyFileSync(cssSource, resolve(distDir, 'content.css'))

        const iconsDir = resolve(__dirname, 'icons')
        const distIconsDir = resolve(distDir, 'icons')
        if (existsSync(iconsDir)) {
          if (!existsSync(distIconsDir)) mkdirSync(distIconsDir, { recursive: true })
          for (const file of readdirSync(iconsDir)) {
            copyFileSync(resolve(iconsDir, file), resolve(distIconsDir, file))
          }
        }
      },
    },
  ],
})

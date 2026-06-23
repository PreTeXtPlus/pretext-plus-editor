import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  if (mode === 'lib') {
    return {
      plugins: [
        react(),
        tailwindcss()
      ],
      build: {
        lib: {
          entry: path.resolve(__dirname, 'src/index.ts'),
          name: 'PretextWebEditor',
          fileName: (format) => {
            if (format === 'es') return 'index.es.js'
            return 'index.js'
          }
        },
        rollupOptions: {
          // Regexes (not exact strings) so every subpath (react/jsx-runtime,
          // react-dom/client, use-sync-external-store/shim/with-selector, ...)
          // stays external too. Without this, transitive CJS deps that
          // `require('react')` get inlined with a runtime CJS-interop shim
          // that throws "Dynamic require of react is not supported" once the
          // consuming app's bundler processes it.
          external: [/^react($|\/)/, /^react-dom($|\/)/, /^use-sync-external-store($|\/)/],
          output: {
            globals: {
              react: 'React',
              'react/jsx-runtime': 'React',
              'react-dom': 'ReactDOM',
              'use-sync-external-store/shim/index.js': 'useSyncExternalStoreShim',
              'use-sync-external-store/shim/with-selector.js': 'useSyncExternalStoreShimWithSelector'
            }
          }
        },
        sourcemap: true,
        minify: true
      }
    }
  }
  
  return {
    plugins: [
      react(),
      tailwindcss()
    ]
  }
})

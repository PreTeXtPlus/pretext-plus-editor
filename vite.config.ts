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
          external: ['react', 'react-dom'],
          output: {
            globals: {
              react: 'React',
              'react-dom': 'ReactDOM'
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

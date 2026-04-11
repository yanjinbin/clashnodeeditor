import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import type { Plugin } from 'vite'

/** Dev-only middleware that mirrors the Vercel Edge Function at api/proxy.ts */
function devProxyPlugin(): Plugin {
  return {
    name: 'dev-cors-proxy',
    configureServer(server) {
      server.middlewares.use('/api/proxy', async (req, res) => {
        const qs = req.url?.slice(1) ?? ''
        const params = new URLSearchParams(qs)
        const target = params.get('url')
        const ua = params.get('ua') || 'clash-verge/v2.2.3'
        if (!target) { res.statusCode = 400; res.end('Missing url'); return }
        try {
          const upstream = await fetch(target, {
            headers: { Accept: 'text/plain,application/x-yaml,text/yaml,*/*', 'User-Agent': ua },
          })
          const text = await upstream.text()
          res.setHeader('Content-Type', 'text/plain; charset=utf-8')
          res.statusCode = upstream.status
          res.end(text)
        } catch (err) {
          res.statusCode = 502
          res.end(String(err))
        }
      })
    },
  }
}

export default defineConfig({
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  server: {
    watch: {
      // Ignore AI-agent / runtime state directories that change constantly during dev.
      // Both patterns are required: `**/.omx` covers the dir itself,
      // `**/.omx/**` covers all files inside it (same for .codex).
      ignored: ['**/.omx', '**/.omx/**', '**/.codex', '**/.codex/**'],
    },
  },
  plugins: [react(), tailwindcss(), devProxyPlugin()],
})

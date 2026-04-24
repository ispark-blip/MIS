import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

function cssCompatPlugin() {
  return {
    name: 'css-compat',
    enforce: 'post',
    generateBundle(_, bundle) {
      for (const [key, chunk] of Object.entries(bundle)) {
        if (key.endsWith('.css') && chunk.source) {
          chunk.source = chunk.source
            .replace(/:not\(#\\#\)/g, '')
            .replace(/@property\s+[^{]+\{[^}]*\}/g, '')
            .replace(/@supports\s+\(color:\s*color-mix\([^)]*\)\)\s*\{[^}]*\}/g, '');
        }
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), cssCompatPlugin()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    target: 'es2015',
  },
});

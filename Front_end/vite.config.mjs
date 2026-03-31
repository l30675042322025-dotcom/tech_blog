import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const pages = [
  'index.html',
  'auth.html',
  'category.html',
  'about-author.html',
  'article-detail.html',
  'essay-detail.html',
  'article-edit.html',
  'essay-edit.html',
  'profile.html',
  'my-articles.html',
  'my-essays.html',
];

const rollupInput = Object.fromEntries(
  pages.map((page) => {
    const name = page.replace(/\.html$/i, '');
    return [name, path.resolve(rootDir, page)];
  })
);

export default defineConfig({
  root: rootDir,
  server: {
    host: true,
    port: 5173,
    open: '/index.html',
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: true,
    port: 4173,
  },
  build: {
    rollupOptions: {
      input: rollupInput,
      output: {
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
      },
    },
  },
  optimizeDeps: {
  },
});

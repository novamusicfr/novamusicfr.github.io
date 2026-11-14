import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const r = (p) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  // chemins relatifs : marche dans Electron, Android et sur GitHub Pages
  base: './',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: r('./index.html'),
        desktopLogin: r('./desktop-login.html'),
      },
    },
  },
});

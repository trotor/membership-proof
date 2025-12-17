import { defineConfig } from 'vite';

export default defineConfig({
  // For GitHub Pages: set base to repo name
  // Change this if your repo has a different name
  base: '/membership-proof/',
  build: {
    outDir: 'dist',
  },
  server: {
    open: true,
  },
});

import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src',
  base: './',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    sourcemap: false
  },
  server: {
    port: 5173
  },
  publicDir: '../public',
  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern' // API mới của Dart Sass — API cũ sẽ bị xoá ở Dart Sass 2.0
      }
    }
  }
});

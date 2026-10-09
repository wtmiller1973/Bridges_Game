import { defineConfig } from 'vite';

// base './' lets the built site work from any GitHub Pages sub-path.
export default defineConfig({ base: './', build: { target: 'es2020' } });

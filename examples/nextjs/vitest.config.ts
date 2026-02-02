
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    setupFiles: ["dotenv/config", "./test/setup-env.ts"], // Load .env and mock envs
  },
});

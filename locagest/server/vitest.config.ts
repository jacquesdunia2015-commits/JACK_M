import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: { NODE_ENV: 'test', UPLOAD_DIR: 'test/.uploads' },
    setupFiles: ['test/setup.ts'],
    fileParallelism: false,
  },
});

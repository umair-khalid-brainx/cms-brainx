import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // The specs boot the whole app; its once-a-minute scheduler (GOV-07) mustn't publish into the test database.
    env: { SCHEDULER_DISABLED: 'true' },
  },
});

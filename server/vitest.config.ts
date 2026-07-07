import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    /* Each test file boots its own embedded Postgres; running files in
       parallel makes 4 concurrent initdb runs, which flakes on Windows.
       Sequential is a few seconds slower and reliable. */
    fileParallelism: false,
    hookTimeout: 180_000,
    testTimeout: 60_000,
  },
})

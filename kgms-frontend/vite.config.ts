import react from '@vitejs/plugin-react'
import { defineConfig, type UserConfig } from 'vite'
import type { InlineConfig } from 'vitest'

const config = {
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
} satisfies UserConfig & { test: InlineConfig }

export default defineConfig(config)

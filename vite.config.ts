import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

declare const process: { env: Record<string, string | undefined> }

export default defineConfig({
  plugins: [react()],
  server: {
    // Honor the PORT env var (the Claude Preview tool assigns a free one
    // per agent via autoPort) so parallel worktrees don't collide.
    // Falls back to Vite's default for plain `npm run dev`.
    port: process.env.PORT ? Number(process.env.PORT) : undefined,
  },
})

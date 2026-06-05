# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**hearth-hollow** is a Node.js application with a planned full-stack structure. The project uses:
- CommonJS modules
- Prisma as the ORM (directory exists but not yet configured)
- A structured app/lib/public pattern suggesting a web server with API routes

The project is in early-stage development — directories are scaffolded but contain no production code yet.

## Directory Structure

- **app/** — Application code (API routes, middleware, business logic)
  - `api/` — API endpoints
  - `confirmation/` — Confirmation-related logic
- **lib/** — Reusable library functions and utilities
- **prisma/** — Prisma schema and migrations (not yet configured)
- **public/** — Static assets (will be served by the web server)

## Development Commands

Since the project is early-stage, start by:

1. **Install dependencies:**
   ```powershell
   npm install
   ```

2. **Set up the test runner** (once dependencies are added):
   - Update `package.json` scripts to add a proper test command (e.g., `jest`, `mocha`, `vitest`)
   - Currently defaults to an error message

3. **Add dev server** (if building a web app):
   - Consider adding a dev script (e.g., `node app/server.js` or a framework like Express)
   - Use `npm run dev` convention

4. **Database setup** (Prisma):
   - Once Prisma is installed, run `npx prisma init` and configure `.env`
   - Use `npx prisma migrate dev` for schema changes
   - Use `npx prisma studio` for database exploration

## Key Architecture Decisions

- **CommonJS** (not ES modules) — Use `require()` and `module.exports`
- **Prisma integration** — Directory structure suggests planned database layer; configure `.env` with `DATABASE_URL` once ready
- **No build step** — Currently Node.js runs CommonJS directly; add a build system (esbuild, webpack) only if needed for bundling or TypeScript

## Notes for Future Development

- The project currently has no npm dependencies installed; add them as needed
- Consider adding `node_modules/` to `.gitignore` if not already present
- No TypeScript is configured; stick with plain JavaScript unless there's a specific need
- The app/ directory suggests API-driven development; ensure clear separation between routes, business logic (lib/), and data access (Prisma)

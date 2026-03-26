# EDLP POS — Claude Session Context

> **First thing every session:** Read this file completely before touching any code.

## Project Identity
- App name: EDLP POS (Hybrid Point-of-Sale)
- Client: EDLP Nigeria Limited
- Stage: Sprint 1 (Foundation & Architecture)
- Tech stack: Laravel 12 Pure REST API + React 18 SPA (Vite 6) + Tailwind v4 + TanStack Query + Zustand

## Local Paths
- Windows root: C:\mydocs\edlp-pos
- React: C:\mydocs\edlp-pos\frontend
- WSL: ~/edlp-pos

## QA Rules (edlp_qa_check.sh)
- Never Model::all() without limit/paginate
- All routes in routes/api.php only
- Use Service-Repository pattern
- Branch-scoped queries must use middleware/scope
- No console.log in React production code
- Use CSS variables for colors
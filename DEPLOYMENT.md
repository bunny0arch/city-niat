# Deployment

## Vercel

The root `vercel.json` builds the Vite frontend from `frontend/` and exposes the existing FastAPI application through `api/index.py`.

- Frontend build: `npm --prefix frontend ci && npm --prefix frontend run build`
- Static output: `frontend/dist`
- API routes: `/api/*`
- SPA route fallback: `/index.html`

The Vercel adapter copies the seeded SQLite database into `/tmp` because Vercel's deployed filesystem is read-only. This preserves live preview behavior, but data mutations are ephemeral per serverless instance. Use a hosted database for durable production persistence.

Set `GEMINI_API_KEY`, `GEMINI_MODEL`, and any production `DATABASE_URL` values in Vercel Project Settings when moving beyond the preview deployment.

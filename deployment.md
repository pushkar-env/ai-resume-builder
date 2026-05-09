# Deployment Guide

This project consists of an API Server backend (Node.js) and a Frontend application (`@workspace/resume-maker` built with Vite). 

Since there is a proxy configuration (`clerkProxyMiddleware.ts`), they should generally be deployed as two separate services. 

## 1. Backend (API Server) Deployment

You can deploy the backend on Render, Railway, or any Node.js hosting platform.

### Railway Deployment
1. Log into [Railway](https://railway.app/).
2. Create a **New Project** and select **Deploy from GitHub repo**.
3. Choose your repository containing this project.
4. Go to **Settings > General** for the service and set the **Root Directory** to `/artifacts/api-server` (or if Railway detects the monorepo, configure it to run the api-server).
5. Ensure the start command is configured appropriately (e.g. `pnpm run build && pnpm run start`).
6. Go to **Variables** and add all necessary environment variables:
   - `CLERK_SECRET_KEY`
   - `DATABASE_URL`
   - `OPENAI_API_KEY` (if you are replacing the previous integrations)
   - `RAZORPAY_WEBHOOK_SECRET`
   - `RAZORPAY_MONTHLY_PLAN_ID`
   - `RAZORPAY_YEARLY_PLAN_ID`
   - `NODE_ENV=production`
   - etc.
7. Railway will automatically build and deploy. Once complete, copy the provided URL (e.g., `https://api-service.up.railway.app`).

### Render Deployment
1. Log into [Render](https://render.com/).
2. Click **New > Web Service**.
3. Connect your GitHub repository.
4. Set the **Root Directory** to `artifacts/api-server`.
5. Set the **Environment** to `Node`.
6. Set the **Build Command** to `pnpm install && pnpm build`.
7. Set the **Start Command** to `pnpm start` (or `node dist/index.js`).
8. Add your Environment Variables.
9. Click **Create Web Service**.

---

## 2. Frontend Deployment (Vercel)

The frontend `resume-maker` is built with Vite and works perfectly on Vercel.

1. Log into [Vercel](https://vercel.com/).
2. Click **Add New > Project**.
3. Import your GitHub repository.
4. In the **Configure Project** section:
   - **Framework Preset**: Vite
   - **Root Directory**: `artifacts/resume-maker`
   - **Build Command**: `pnpm run build`
   - **Output Directory**: `dist/public` (as defined in your `vite.config.ts`)
5. **Environment Variables**:
   - `VITE_CLERK_PUBLISHABLE_KEY` (Your Clerk publishable key)
   - `PORT`: `8080` (or leave default if not strictly needed in the UI layer)
   - `API_PROXY_TARGET`: **The URL of your deployed backend** (e.g., `https://api-service.up.railway.app`)
   - `BASE_PATH`: `/`
6. Click **Deploy**.

> [!TIP]
> If you experience CORS issues, ensure your Backend (`api-server`) is configured to accept requests from your Vercel domain.

## Final Steps
1. In the **Clerk Dashboard**, go to **Paths** and configure your proxy/custom domain settings as required.
2. Ensure your Database (Neon, Supabase, or Railway Postgres) is accessible by the backend.

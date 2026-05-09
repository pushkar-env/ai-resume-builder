# Free Tier Deployment Guide

This guide provides step-by-step instructions to deploy the AI Resume Builder project for **free**.

## Recommended Free Stack
* **Frontend:** Vercel (Best in class for React/Vite, excellent free tier)
* **Backend:** Render (Free web service with automated sleep during inactivity)
* **Database:** Neon (Serverless Postgres with a generous free tier)
* **Auth:** Clerk (Generous free tier for authentication)
* **Payments:** Razorpay (Test mode is free)

---

## 1. Database Deployment (Neon)
1. Go to [Neon.tech](https://neon.tech) and create a free account.
2. Create a new Postgres project.
3. Once created, copy your `DATABASE_URL` (it will look like `postgres://user:password@hostname/dbname?sslmode=require`).
4. Save this URL for your backend configuration.

## 2. Backend Deployment (Render)
1. Push your code to a GitHub repository.
2. Go to [Render.com](https://render.com) and sign up.
3. Click **New +** and select **Web Service**.
4. Connect your GitHub account and select your repository.
5. **Configuration:**
   * **Name:** `ai-resume-api`
   * **Root Directory:** *(leave blank / empty)*
   * **Environment:** `Node`
   * **Build Command:** `pnpm install && pnpm --filter @workspace/api-server run build`
   * **Start Command:** `pnpm --filter @workspace/api-server run start`
   * **Instance Type:** Free
6. **Environment Variables:**
   * Add `DATABASE_URL` (from Neon)
   * Add `CLERK_SECRET_KEY` and `CLERK_PUBLISHABLE_KEY`
   * Add `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`
   * Add `RAZORPAY_WEBHOOK_SECRET`, `RAZORPAY_MONTHLY_PLAN_ID`, and `RAZORPAY_YEARLY_PLAN_ID`
   * Add `OPENAI_API_KEY`
   * Add `FRONTEND_URL` (e.g., `https://your-frontend-url.vercel.app` - you will set this after deploying the frontend).
7. Click **Create Web Service**. 
8. Render will provide a URL (e.g., `https://ai-resume-api.onrender.com`). Copy this.

*Note: Render free instances spin down after 15 minutes of inactivity. The first API request after a while may take ~30 seconds to wake up.*

### Alternative: Backend Deployment (Railway)
If you prefer Railway (which offers a generous free/hobby tier without the spin-down delay):
1. Log into [Railway.app](https://railway.app/).
2. Create a **New Project** and select **Deploy from GitHub repo**.
3. Choose your repository.
4. Go to **Settings > General** for the service and ensure the **Root Directory** is left blank (or `/`). This is critical for monorepos!
5. Set the **Build Command** to `pnpm install && pnpm --filter @workspace/api-server run build`.
6. Set the **Start Command** to `pnpm --filter @workspace/api-server run start`.
7. Go to **Variables** and add all the necessary environment variables listed in the Render section above (including `DATABASE_URL`, `FRONTEND_URL`, Clerk keys, and Razorpay keys).
8. Railway will automatically build and deploy. Once complete, copy the provided URL (e.g., `https://ai-resume-api.up.railway.app`) and use it for your `VITE_API_URL` on Vercel.

## 3. Frontend Deployment (Vercel)
1. Go to [Vercel.com](https://vercel.com) and sign in with GitHub.
2. Click **Add New -> Project** and import your repository.
3. **Configuration:**
   * **Framework Preset:** Vite
   * **Root Directory:** `artifacts/resume-maker`
   * **Build Command:** `pnpm run build`
   * **Output Directory:** `dist`
4. **Environment Variables:**
   * `VITE_API_URL`: Your Render (or Railway) backend URL (e.g., `https://ai-resume-api.onrender.com/api`)
   * `VITE_CLERK_PUBLISHABLE_KEY`: Your Clerk frontend key.
   * `VITE_RAZORPAY_KEY_ID`: Your Razorpay public key.
5. Click **Deploy**. Vercel will build and assign you a fast, global CDN link (e.g., `https://ai-resume-builder.vercel.app`).

> [!TIP]
> If you experience CORS issues, ensure your Backend (`api-server`) is configured to accept requests from your Vercel domain. To avoid iOS Safari authentication issues (ITP), configure your Clerk proxy domain and set `VITE_CLERK_PROXY_URL` in Vercel. Point it to `https://ai-resume-api.onrender.com/api/webhooks/clerk`.

## 4. Final Setup (Webhooks & CORS)
1. **Clerk Webhooks:** Go to Clerk Dashboard -> Webhooks. Point it to `https://ai-resume-api.onrender.com/api/webhooks/clerk`.
2. **Razorpay Webhooks:** Go to Razorpay Dashboard -> Webhooks. Point it to `https://ai-resume-api.onrender.com/api/payments/webhook`.
3. **Backend CORS:** In your Render dashboard, ensure your `FRONTEND_URL` exactly matches your Vercel URL so the backend accepts requests.

## 5. Going Live (Razorpay)

Switching to Live Mode in Razorpay requires creating new plans and updating your environment variables.

### Step 1: Switch to Live Mode & Get API Keys
1. Go to your [Razorpay Dashboard](https://dashboard.razorpay.com/).
2. Switch the toggle in the dashboard from **Test Mode** to **Live Mode**. *(Note: KYC activation is required to accept real payments).*
3. Navigate to **Account & Settings** -> **API Keys**.
4. Generate a new Live API Key. You will get a new `Key ID` (starts with `rzp_live_`) and a `Key Secret`. Keep these secure.

### Step 2: Re-create Your Subscription Plans
Test plans **do not** transfer over to Live Mode.
1. In the Live Mode dashboard, go to **Subscriptions** -> **Plans**.
2. Create your **Monthly Plan** and **Yearly Plan** with your desired live pricing.
3. Copy the newly generated `plan_...` IDs for both.

### Step 3: Setup the Live Webhook
1. Go to **Account & Settings** -> **Webhooks**.
2. Add a new Webhook pointing to your deployed backend: `https://your-api-url.onrender.com/api/payments/webhook`.
3. Enter a secure secret.
4. Select the Active Events: `subscription.activated` and `subscription.cancelled`.
5. Click **Create Webhook**.

### Step 4: Update Your Environment Variables

**On Vercel (Frontend):**
1. Go to your project -> **Settings** -> **Environment Variables**.
2. Update `VITE_RAZORPAY_KEY_ID` with your new **Live Key ID** (`rzp_live_...`).
3. Save and **Redeploy** your frontend.

**On Render (Backend):**
1. Go to your Web Service -> **Environment**.
2. Update the following variables:
   * `RAZORPAY_KEY_ID`: Your new **Live Key ID**.
   * `RAZORPAY_KEY_SECRET`: Your new **Live Key Secret**.
   * `RAZORPAY_MONTHLY_PLAN_ID`: Your new live monthly plan ID.
   * `RAZORPAY_YEARLY_PLAN_ID`: Your new live yearly plan ID.
   * `RAZORPAY_WEBHOOK_SECRET`: (Update if you changed the secret).
3. Save changes. Render will automatically restart your backend.

*Tip: Perform a test transaction of a tiny amount (like ₹1 or $1) to ensure the webhook successfully upgrades your account to Pro before launching publicly.*

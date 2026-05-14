# Free Tier Deployment Guide

This guide provides step-by-step instructions to deploy the AI Resume Builder project for **free**.

## Recommended Free Stack
* **Frontend:** Vercel (Best in class for React/Vite, excellent free tier)
* **Backend:** Render (Free web service with automated sleep during inactivity)
* **Database:** Neon (Serverless Postgres with a generous free tier)
* **Auth:** Clerk (Generous free tier for authentication)
* **Payments:** Razorpay (Test mode is free)
* **Contact form email:** [Resend](https://resend.com) (free tier for transactional email; API key + verified domain)

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
   * For the **Contact us** form (see [Contact form email (Resend)](#2b-contact-form-email-resend)): `RESEND_API_KEY`, `CONTACT_FROM_EMAIL`, and optionally `CONTACT_TO_EMAIL`.
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
7. Go to **Variables** and add all the necessary environment variables listed in the Render section above (including `DATABASE_URL`, `FRONTEND_URL`, Clerk keys, Razorpay keys, and Resend contact variables from [Contact form email (Resend)](#2b-contact-form-email-resend)).
8. Railway will automatically build and deploy. Once complete, copy the provided URL (e.g., `https://ai-resume-api.up.railway.app`) and use it for your `VITE_API_URL` on Vercel.

---

## 2b. Contact form email (Resend)

The **Contact us** page sends messages through your **API** (`POST /api/contact`). The API calls **Resend** to deliver email to your support inbox (default **support@resumesensei.com**). Nothing contact-related is configured on Vercel except making sure **`VITE_API_URL`** already points at your API (see below).

### Get a Resend API key

1. Create a free account at [resend.com](https://resend.com) and open the [Resend Dashboard](https://resend.com/dashboard).
2. Go to **API Keys** → **Create API key**. Give it a name (e.g. `resume-builder-production`), choose permission **Sending access** (or full access if that is the only option), and create the key. **Copy it once** — you will not see the full secret again. This value is your **`RESEND_API_KEY`**.
3. **Verified “from” address:** Resend only sends from addresses tied to a **verified domain** (recommended for production) or, for quick tests, their onboarding domain with tight limits. For **production**:
   * In the dashboard go to **Domains** → **Add domain** and enter your site domain (e.g. `resumesensei.com`).
   * Add the **DNS records** (usually TXT for SPF/DKIM) that Resend shows at your DNS host (Cloudflare, Vercel DNS, etc.).
   * Wait until the domain shows as **Verified** in Resend.
4. Choose a sender that uses that domain for **`CONTACT_FROM_EMAIL`**, for example: `ResumeSensei <hello@resumesensei.com>` (the part in angle brackets must be an address on the verified domain). This is the address users see as the sender; replies still go to the visitor’s email via **Reply-To** on each message.

Resend’s free tier and limits change over time — see [Resend pricing](https://resend.com/pricing).

### Backend environment variables (Railway or Render)

Set these on the **same service** that runs `api-server` (e.g. your Railway project):

| Variable | Required? | Purpose |
|----------|------------|---------|
| `RESEND_API_KEY` | **Yes** (for sending) | Secret from Resend **API Keys**. Without it, the contact endpoint returns **503** and the UI shows an error. |
| `CONTACT_FROM_EMAIL` | **Yes** (for sending) | Verified sender string, e.g. `ResumeSensei <hello@resumesensei.com>`. Must match what Resend allows for your domain. |
| `CONTACT_TO_EMAIL` | No | Inbox that receives submissions. Defaults to **`support@resumesensei.com`** if omitted. |

After saving variables, **redeploy or restart** the API so the new values load.

### Frontend (Vercel) — what you need

You **do not** add the Resend secret to Vercel. The browser only talks to **your API**.

* Ensure **`VITE_API_URL`** is set to your public API base **including the `/api` path**, for example:  
  `https://your-service.up.railway.app/api`  
  The contact form calls `POST {VITE_API_URL}/contact` → `…/api/contact` on the server.
* Keep **`FRONTEND_URL`** on Railway set to your exact Vercel URL (e.g. `https://your-app.vercel.app`) so **CORS** continues to allow the contact `POST` from the browser.

### Quick test

1. Deploy the API with `RESEND_API_KEY` and `CONTACT_FROM_EMAIL` set.
2. Open your production **Contact** page, submit a test message, and confirm delivery in **`CONTACT_TO_EMAIL`** (or the default support inbox).
3. If it fails, check Railway logs for `contact:` lines and confirm the domain and **from** address are verified in Resend.

## 3. Frontend Deployment (Vercel)
1. Go to [Vercel.com](https://vercel.com) and sign in with GitHub.
2. Click **Add New -> Project** and import your repository.
3. **Configuration:**
   * **Framework Preset:** Vite
   * **Root Directory:** `artifacts/resume-maker`
   * **Build Command:** `pnpm run build`
   * **Output Directory:** `dist`
4. **Environment Variables:**
   * `VITE_API_URL`: Your Render or **Railway** backend URL **with `/api` on the end** (e.g. `https://ai-resume-api.onrender.com/api` or `https://your-service.up.railway.app/api`). Required for authenticated API calls **and** for the public **Contact us** form (`POST …/contact`).
   * `VITE_CLERK_PUBLISHABLE_KEY`: Your Clerk frontend key.
   * `VITE_RAZORPAY_KEY_ID`: Your Razorpay public key.
5. Click **Deploy**. Vercel will build and assign you a fast, global CDN link (e.g., `https://ai-resume-builder.vercel.app`).

> [!TIP]
> If you experience CORS issues, ensure your Backend (`api-server`) is configured to accept requests from your Vercel domain. To reduce iOS Safari issues with third-party cookies (ITP), configure a **Clerk Frontend API proxy** in the Clerk Dashboard and set `VITE_CLERK_PROXY_URL` on Vercel to your backend proxy base URL, for example `https://ai-resume-api.onrender.com/api/__clerk` (this project serves the proxy at path `/api/__clerk` on the API host).

## 4. Final Setup (Webhooks & CORS)
1. **Clerk:** In the Clerk Dashboard, add your **production** frontend URL (and your API origin if required) under **Domains** / **Allowed origins** so sign-in works on Vercel. **Clerk webhooks** are optional unless you add a handler route on your API; this repo uses Clerk for auth/session and Razorpay webhooks for billing. If you add a Clerk webhook endpoint later, register its full URL under **Webhooks** and store the signing secret (for example as `CLERK_WEBHOOK_SECRET`) in your backend.
2. **Razorpay Webhooks:** In the Razorpay Dashboard (same mode as your keys), go to **Account & Settings** → **Webhooks**. Point the URL to `https://your-api-url.onrender.com/api/payments/webhook` (replace with your real API base + `/api/payments/webhook`).
3. **Backend CORS:** On **Render** or **Railway**, ensure **`FRONTEND_URL`** exactly matches your Vercel URL (scheme + host, no trailing slash unless your app expects it) so the backend accepts browser requests, including anonymous **`POST /api/contact`** from the marketing **Contact** page.
4. **Contact form:** Confirm **`RESEND_API_KEY`** and **`CONTACT_FROM_EMAIL`** are set on the API (see [Contact form email (Resend)](#2b-contact-form-email-resend)). No extra Vercel secrets are required beyond a correct **`VITE_API_URL`**.

---

## 5. Moving from test to live (Clerk & Razorpay)

**Important distinction:** Razorpay uses a **Test / Live** toggle in one account. Clerk instead uses separate **Development** and **Production** instances (different API keys). “Going live” for Clerk means deploying with **production** keys and domains, not flipping a “test mode” switch on the same key pair.

### 5.1 Do you have to pay money?

| Service | Enabling “live” / production | Ongoing costs |
|--------|------------------------------|----------------|
| **Clerk** | No fee to create a Production instance or to use production API keys (`pk_live_…` / `sk_live_…`). | **Free tier:** Clerk’s free plan includes a monthly active user (MAU) allowance; you only pay if you **choose a paid Clerk plan** or exceed free limits. Check [Clerk pricing](https://clerk.com/pricing) for current numbers. |
| **Razorpay** | No separate “activation fee” for standard accounts; you complete **KYC** (identity/business verification) to accept real money. KYC itself does not charge you. | **Per successful payment:** Razorpay charges a **transaction fee** (percentage + GST in India, method-dependent). You are not charged by Razorpay just to keep live mode on with zero sales. Pricing changes over time—see [Razorpay pricing](https://razorpay.com/pricing/). |

**Summary:** You do **not** need to pay Clerk or Razorpay up front simply to switch off test/dev. You **do** pay Razorpay fees when customers successfully pay you; you **may** pay Clerk if you outgrow the free tier or upgrade.

---

### 5.2 Clerk — exact steps (development → production)

1. Open the [Clerk Dashboard](https://dashboard.clerk.com/) and select your application.
2. Use the environment switcher (typically **Development** vs **Production**) at the top. If you have not created production yet, use **Create production instance** (or equivalent) and follow the prompts.
3. **Production URLs:** In the **Production** instance, under **Domains** / **Paths** (wording varies by Clerk version), add:
   * Your real Vercel URL (e.g. `https://your-app.vercel.app`).
   * Any custom domain you use.
   * Do **not** rely on `localhost` for production keys; production keys expect HTTPS on configured hosts.
4. **API keys (Production):** In **API Keys** for the **Production** instance, copy:
   * **Publishable key** (`pk_live_…`) → set as `VITE_CLERK_PUBLISHABLE_KEY` on Vercel and use the same value conceptually for any “publishable” slot in docs (frontend only).
   * **Secret key** (`sk_live_…`) → set as `CLERK_SECRET_KEY` on Render/Railway (backend only; never commit or expose in the browser).
5. **Same variable names on the server:** Set `CLERK_PUBLISHABLE_KEY` on the backend to the **same** production publishable key if your server expects it (this project uses `CLERK_PUBLISHABLE_KEY` in `app.ts` together with `CLERK_SECRET_KEY`).
6. **Clerk proxy (optional but recommended for production):** In Clerk, configure the proxy URL to match how you deploy (see Clerk docs for “Frontend API proxy”). Set `VITE_CLERK_PROXY_URL` on the frontend to your API’s Clerk proxy base, e.g. `https://your-api.onrender.com/api/__clerk`.
7. **Webhooks:** If you use Clerk webhooks, create the endpoint in the **Production** instance and paste the **production** signing secret into your backend env. Development and Production webhook secrets differ.
8. **Redeploy** Vercel and restart the API after changing env vars. Test sign-in/sign-up on the production URL.

Keep using **Development** keys (`pk_test_…` / `sk_test_…`) only for local development.

---

### 5.3 Razorpay — exact steps (test mode → live mode)

Switching to Live Mode uses **new** live keys and **new** plan IDs; test artifacts do not carry over.

#### Step A: Complete activation (KYC) and switch to Live
1. Go to the [Razorpay Dashboard](https://dashboard.razorpay.com/).
2. Complete **account activation / KYC** as prompted (business or individual, bank details, etc.). Until this is approved, live payouts and sometimes live charges may be restricted.
3. Toggle the dashboard from **Test Mode** to **Live Mode**.

#### Step B: Live API keys
1. In **Live Mode**, open **Account & Settings** → **API Keys**.
2. Generate **Live** keys. You will get `rzp_live_…` and a **Key Secret**. Store them only in server-side env (e.g. Render).

#### Step C: Re-create subscription plans in Live mode
Test plans **do not** exist in Live mode.
1. With the dashboard in **Live Mode**, go to **Subscriptions** → **Plans**.
2. Create **Monthly** and **Yearly** plans at your real prices.
3. Copy the new **`plan_…`** IDs.

#### Step D: Live webhook
1. Still in **Live Mode**, go to **Account & Settings** → **Webhooks**.
2. Add a webhook URL: `https://your-api-url.onrender.com/api/payments/webhook`.
3. Set a strong webhook secret; subscribe to events your code handles (e.g. `subscription.activated`, `subscription.cancelled`—match what `api-server` expects).
4. Put that secret in `RAZORPAY_WEBHOOK_SECRET` on the backend.

#### Step E: Update environment variables

**Vercel (frontend)**  
1. **Settings** → **Environment Variables**.  
2. Set `VITE_RAZORPAY_KEY_ID` to the **live** Key ID (`rzp_live_…`).  
3. Redeploy.

**Render / Railway (backend)**  
1. Set `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_MONTHLY_PLAN_ID`, `RAZORPAY_YEARLY_PLAN_ID`, and `RAZORPAY_WEBHOOK_SECRET` to the **live** values.  
2. Save and restart the service.

#### Step F: Verify before launch
Run a **small real payment** (e.g. minimum allowed amount) and confirm the webhook fires and premium state updates as expected. Razorpay’s dashboard logs help debug signature or URL mismatches.

# Production-Grade Deployment Guide

This guide outlines the architecture and deployment strategy for running the AI Resume Builder at scale, ensuring high availability, speed, and reliability.

## Production Stack Recommendations
* **Frontend:** Vercel (Pro) or AWS Amplify. (Vercel Pro provides better Edge network performance).
* **Backend:** AWS ECS (Fargate) or DigitalOcean App Platform. Alternatively, Render (Pro) for ease of use.
* **Database:** Supabase (Pro) or AWS RDS (PostgreSQL). Supabase provides built-in connection pooling via PgBouncer.
* **Auth & Payments:** Clerk (Pro) & Razorpay (Live Mode).
* **Observability:** Datadog, Sentry, or Logflare for centralized logging and crash reporting.

---

## 1. Database (Supabase Pro / AWS RDS)
1. Provision a PostgreSQL instance with a minimum of 2vCPUs and 4GB RAM to handle heavy Drizzle ORM read/write queries.
2. Enable connection pooling. Serverless environments can exhaust database connections quickly. Supabase provides this out-of-the-box (Port 6543).
3. Set up automated daily backups and Point-In-Time-Recovery (PITR).

## 2. Backend (AWS ECS Fargate or DigitalOcean App Platform)
The Node.js/Express backend handles heavy PDF/resume generation operations and OpenAI requests. It should not be deployed on a serverless function (like AWS Lambda) because PDF generation can exceed Lambda timeout limits.

1. **Dockerize the Backend**: Create a `Dockerfile` in `artifacts/api-server`.
2. **Deploy to DigitalOcean App Platform** (Easier than AWS):
   * Connect GitHub and select the `artifacts/api-server` directory.
   * Auto-detect the Dockerfile.
   * Scale to at least 2 instances for high availability and zero-downtime deployments.
3. **Environment Variables**:
   * Set `NODE_ENV=production`.
   * Configure securely using a Secret Manager (e.g., AWS Secrets Manager or DO App Secrets).
   * Ensure `CORS_ORIGIN` strictly points to your production custom domain.

## 3. Frontend (Vercel Pro)
1. Deploy `artifacts/resume-maker` to Vercel on a Pro plan.
2. Attach your custom domain (e.g., `resumeai.com`).
3. Vercel automatically handles SSL, Edge Caching, and global CDN distribution.
4. Set production environment variables (`VITE_API_URL`, `VITE_CLERK_PUBLISHABLE_KEY` for live mode).

## 4. Continuous Integration / Continuous Deployment (CI/CD)
1. **GitHub Actions**: Create `.github/workflows/main.yml`.
2. Configure tests (`pnpm run typecheck` and any unit tests) to run on Pull Requests.
3. Only merge to `main` if tests pass.
4. Pushing to `main` should automatically trigger Vercel to build the frontend and DigitalOcean to rebuild and roll out the backend Docker container.

## 5. Security & Scaling Considerations
* **Webhooks:** Secure all webhooks (Clerk, Razorpay) by verifying the payload signatures. Ensure `CLERK_WEBHOOK_SECRET` and `RAZORPAY_WEBHOOK_SECRET` are correctly configured in production.
* **Rate Limiting:** Implement Redis-based rate limiting on the backend, specifically on the OpenAI generation routes (`/api/ai/generate`), to prevent billing abuse.
* **Logging:** Integrate **Sentry** into both the React frontend and Express backend to immediately catch 500 errors and JS crashes in production.

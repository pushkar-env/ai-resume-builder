# Standardizing Domain to www.resumesensei.com

This guide covers the exact steps to migrate your live site seamlessly from the naked domain (`resumesensei.com`) to the `www` subdomain (`www.resumesensei.com`), ensuring Clerk authentication continues to work and SEO rankings are preserved.

The reason you saw a "blank page and Clerk errors" when you tried this previously is due to **Origin Mismatch** and **Cross-Origin Cookie Policies**. Clerk was expecting requests from `resumesensei.com`, so when it received them from `www.resumesensei.com`, it blocked them for security reasons. 

To do this correctly without breaking your live site, you must coordinate changes across Vercel, Clerk, Cloudflare, and Google Search Console in a specific order.

---

## Step 1: Update the Primary Domain in Clerk Dashboard

Before you force the redirect on your hosting or DNS provider, you need to tell Clerk to expect the `www` subdomain.

1. Go to your [Clerk Dashboard](https://dashboard.clerk.com/).
2. Select your production instance for **Resume Sensei**.
3. Navigate to **Configure > Domains**.
4. If your primary domain is currently set to `resumesensei.com`, you need to change it to `www.resumesensei.com`.
5. **CRITICAL:** Clerk will give you new DNS records (usually 2-3 CNAME records) when you change the domain. **Do not close this page yet.**

## Step 2: Update DNS Records in Cloudflare

Now, you need to configure Cloudflare to point the new Clerk DNS records correctly and ensure both versions of your domain are pointing to Vercel.

1. Log into your [Cloudflare Dashboard](https://dash.cloudflare.com/) and select `resumesensei.com`.
2. Go to **DNS > Records**.
3. **Add Clerk CNAMEs:** Add the new CNAME records provided by Clerk in Step 1. Make sure the Proxy status is set to **DNS Only (Gray Cloud)** for these specific Clerk records.
4. **Verify Hosting Records:** 
   - Ensure you have a record for your apex domain (`@` or `resumesensei.com`) pointing to Vercel.
   - Ensure you have a record for `www` pointing to Vercel.

## Step 3: Configure Redirects in Vercel

Vercel is the easiest place to handle the `http/https` and `apex to www` redirects. 

1. Go to your [Vercel Dashboard](https://vercel.com/) and open the Resume Sensei frontend project.
2. Navigate to **Settings > Domains**.
3. You should have both `resumesensei.com` and `www.resumesensei.com` added here. 
   *(If not, add them both).*
4. Click the **Edit** button next to the naked domain (`resumesensei.com`).
5. Select **Redirect to** and choose `www.resumesensei.com`.
6. Make sure the status code is set to **308 Permanent Redirect** (Vercel's default for permanent redirects, which acts like a 301).
7. Set `www.resumesensei.com` as your **Primary Domain**.

*(Note: Since Vercel is handling the redirect, you do NOT need to set up Page Rules in Cloudflare. Vercel automatically enforces HTTPS and redirects the apex domain to the www subdomain.)*

## Step 4: Verify Environment Variables

Check if you have any hardcoded URLs in your environment variables.
1. In Vercel, go to **Settings > Environment Variables**.
2. If you have variables like `NEXT_PUBLIC_APP_URL` or `VITE_APP_URL`, ensure they are explicitly set to `https://www.resumesensei.com`.
3. Check your Railway API Backend environment variables. If you have CORS origins configured (e.g., `CORS_ORIGIN`), ensure you add `https://www.resumesensei.com` to the allowed origins.

## Step 5: Update Google Search Console (SEO Preservation)

Since your site is already indexed as `resumesensei.com`, you need to tell Google about the move so you don't lose your search rankings.

1. Log into [Google Search Console](https://search.google.com/search-console).
2. If you don't already have one, create a new property for `https://www.resumesensei.com` (or use a Domain Property that covers both).
3. In the property for `resumesensei.com`, go to **Settings > Change of Address**.
4. Select your new `www.resumesensei.com` property as the destination.
5. Google will run a quick check to verify the 301/308 redirects are working correctly (which Vercel is now handling). Click **Confirm**.

---

### Troubleshooting Checklist

If you still see a blank screen or Clerk errors after following these steps:

1. **Clear Browser Cache / Incognito:** Cookie mismatches from your old session might cause a loop. Test the site in an Incognito window.
2. **Check Clerk DNS Propagation:** In the Clerk Dashboard (Domains tab), ensure all DNS records show a green "Verified" checkmark. If they don't, Cloudflare might be proxying them (Orange Cloud). Ensure Clerk DNS records in Cloudflare are set to **DNS Only**.
3. **CORS on API:** If the frontend loads but saving data fails, your Railway API (`ai-resume-api-production.up.railway.app`) is blocking the new `www` origin. Update your backend CORS settings to allow `https://www.resumesensei.com`.

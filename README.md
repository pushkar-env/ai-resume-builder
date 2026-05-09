# AI Resume Builder

A full-stack, modern AI Resume Builder that allows users to create, customize, and export professional resumes. It leverages OpenAI for intelligent content generation, Clerk for seamless authentication, and Razorpay for premium subscription management.

## 🚀 Tech Stack

- **Frontend:** React 19, Vite, Tailwind CSS (v4), Framer Motion, Wouter
- **Backend:** Node.js, Express, tRPC / Zod API Specification
- **Database:** PostgreSQL (Neon), Drizzle ORM
- **Authentication:** Clerk
- **Payments:** Razorpay
- **AI Integration:** OpenAI API
- **Monorepo Management:** PNPM Workspaces

## 📁 Project Structure

This project is structured as a PNPM workspace monorepo.

```
AI-Resume-Builder/
├── artifacts/
│   ├── api-server/         # Backend Node.js Express server
│   └── resume-maker/       # Frontend React + Vite application
├── lib/
│   ├── api-client-react/   # React Query API client
│   ├── api-spec/           # Shared API specifications (Zod/tRPC)
│   ├── api-zod/            # Shared Zod schemas
│   ├── db/                 # Drizzle ORM models and database configuration
│   └── integrations/       # External service integrations (OpenAI, Razorpay, Clerk)
├── package.json            # Root configuration and workspace scripts
└── pnpm-workspace.yaml     # PNPM workspace definition
```

## 🛠️ Local Development Setup

### Prerequisites

- [Node.js](https://nodejs.org/) (v20+ recommended)
- [PNPM](https://pnpm.io/) (v9+)

### Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd AI-Resume-Builder
   ```

2. **Install dependencies:**
   ```bash
   pnpm install
   ```

3. **Environment Variables:**
   Set up your environment variables for both the backend and the frontend. You will need keys for Clerk, OpenAI, Razorpay, and your PostgreSQL database.
   - Create an `.env` file in `artifacts/api-server/` based on backend requirements.
   - Create an `.env` file in `artifacts/resume-maker/` based on frontend requirements.

4. **Database Migration:**
   Ensure your database is set up and push the Drizzle schema:
   ```bash
   pnpm run db:push
   ```

### Running the Project

Start both the backend API and the frontend web app concurrently:

```bash
pnpm run dev
```

This will run:
- API Server on its designated port.
- Vite Frontend server on its designated port.

Alternatively, you can run them individually:
- Backend: `pnpm run dev:api`
- Frontend: `pnpm run dev:web`

## 🌍 Deployment

For detailed deployment instructions for production and free tiers, please refer to the dedicated deployment guides:

- [Standard Deployment Guide](deployment.md) - For standard deployments (Render, Railway, Vercel).
- [Free Tier Deployment Guide](freedeployment.md) - For deploying on entirely free tiers (Render, Vercel, Neon).

## 📝 License

MIT

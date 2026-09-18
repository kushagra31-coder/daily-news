# Daily Vanish 📰💨

**Today's news. Gone tomorrow.**

Daily Vanish is an ephemeral, real-time news aggregator that automatically discovers, clusters, and verifies breaking news. Inspired by the fleeting nature of the 24-hour news cycle, stories exist for exactly 24 hours before they permanently vanish from the feed.

## 🚀 Features

- **Ephemeral Architecture**: Articles carry a strict 24-hour TTL (Time-To-Live). Once the clock hits zero, the news vanishes.
- **Algorithmic Clustering**: Uses a custom **64-bit SimHash** algorithm and Hamming distance evaluation to detect near-duplicate headlines across multiple publishers and group them into unified "Clusters".
- **Source Verification**: Automatically corroborates stories across multiple trusted publishers to calculate a real-time verification score (High, Moderate, Low).
- **Edge-Native**: The entire stack runs on the Edge for near-zero latency, utilizing Cloudflare Workers and Turso.
- **Beautiful UI**: Built with Next.js and Framer Motion, featuring smooth exit animations when articles expire, and a live countdown to the next daily reset.

## 🛠️ Tech Stack

### Frontend
- **Next.js 14** (App Router)
- **React 18**
- **Tailwind CSS**
- **Framer Motion** (Animations)
- **SWR** (Real-time data polling)
- Hosted on **Vercel**

### Backend
- **Cloudflare Workers** (Edge Compute)
- **Hono** (Web Framework)
- **Drizzle ORM** (Type-safe SQL)
- **Cloudflare Cron Triggers** (Automated data ingestion)
- Hosted on **Cloudflare**

### Database
- **Turso / LibSQL** (Edge SQLite)

## 🏗️ Architecture

1. **Ingestion**: A Cloudflare Cron Job wakes up every 30 minutes, fetching RSS feeds from top global publishers (BBC, Reuters, TechCrunch, etc.).
2. **Processing**: The worker tokenizes the headlines, generates a 64-bit SimHash, and compares it against active clusters in Turso.
3. **Clustering**: If the Hamming distance is within the threshold (e.g., `< 12` bits), it adds the article to the existing cluster and bumps the verification score. If not, a new cluster is born.
4. **Delivery**: The Next.js frontend polls the Cloudflare Worker API. When an article reaches its 24-hour expiration, Framer Motion seamlessly animates it out of the DOM.

## 💻 Local Development

### Prerequisites
- Node.js (v18+)
- npm or pnpm
- Cloudflare Wrangler CLI
- Turso CLI (Optional, for local DB inspection)

### 1. Database Setup
```bash
# Navigate to the DB package
cd packages/db

# Generate Drizzle migrations
npx drizzle-kit generate
```

### 2. Backend (Cloudflare Worker)
```bash
cd apps/worker

# Create a local .dev.vars file and add your Turso Credentials:
# TURSO_URL="libsql://your-db-url.turso.io"
# TURSO_AUTH_TOKEN="your-token"

# Run the worker locally
npx wrangler dev
```

### 3. Frontend (Next.js)
```bash
cd frontend

# Create a .env.local file:
# BACKEND_URL="http://localhost:8787"

# Start the dev server
npm run dev
```
Visit `http://localhost:3000` to view the app!


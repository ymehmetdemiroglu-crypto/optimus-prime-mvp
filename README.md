# Grok AdMaster

AI-powered "War Room" dashboard for Amazon sellers that automates PPC, SEO, and DSP strategies using Multi-Armed Bandits, Q-Learning, and Forecasting models.

## Features

- 📊 **War Room Dashboard** - Real-time KPIs, sales velocity charts, and an autonomous AI action feed.
- 🎯 **Campaign Manager** - Keyword-level bid management with AI strategy toggles (Auto Pilot, Aggressive, Profit Guard) and CSV Export.
- 🧠 **Bid Optimization** - Advanced mathematical modeling for bids:
  - **Thompson Sampling**: Bayesian Multi-Armed Bandit strategy balancing exploration vs exploitation.
  - **Q-Learning**: Reinforcement Learning using the Bellman Equation to adapt to historical performance states.
  - **Ensemble Blend**: Multi-model system compounding statistical forecasts and reinforcement signals.
- 📈 **Forecasting Engine** - Time-series prediction using EWMA (Exponentially Weighted Moving Average).
- 🕵️ **Competitive Intelligence** - ASIN tracking and competitor insights.
- 🔔 **Rule Engine & Alerts** - Automated alerts for out-of-budget campaigns, high ACoS, and bid graduations.
- 💬 **Grok AI Chat** - Conversational agent integrated with internal store data.
- ⚙️ **Amazon SP-API Integration** - Stub integration for syncing campaign structures and 60-day performance data.
- 🌙 **Cyber-Professional UI** - Dark mode with neon accents, optimized for heavy data interaction.

## Architecture

The system operates on an entirely Serverless architecture powered by **Supabase**:

- **Database**: PostgreSQL with Row-Level Security (RLS) scoping data per seller.
- **Backend Logic**: Supabase Edge Functions (Deno/TypeScript) act as the API layer, computing Q-values and Thompson Beta distributions.
- **Autonomous Operator**: `pg_cron` jobs run inside the database to periodically schedule Edge Functions for fully autonomous, hands-free bid adjustments.
- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS, Recharts.

## Quick Start

### Prerequisites
- Node.js 18+
- Supabase CLI

### Setup

1. **Clone & Install**
   ```bash
   cd client
   npm install
   ```

2. **Environment Variables**
   Rename `client/.env.example` to `client/.env.local` and add your Supabase URL and Anon Key.

3. **Supabase Local Development**
   ```bash
   supabase start
   supabase functions serve --no-verify-jwt
   ```

4. **Run Frontend**
   ```bash
   npm run dev
   ```

### Access
- **Frontend Dashboard**: http://localhost:5173
- **Supabase Studio** (Local DB Management): http://localhost:54323

## Production Deployment

1. Set up a cloud Supabase project.
2. Push the schema using `supabase db push`.
3. Deploy Edge Functions using `supabase functions deploy`.
4. Deploy the React application to Vercel, Netlify, or Cloudflare Pages.
5. In the `Settings` page, configure the **Amazon SP-API** credentials to enable live data.

## License

MIT License - See LICENSE file for details

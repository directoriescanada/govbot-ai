# GovBot AI — Government Contract Intelligence Platform

AI-powered platform that scans, classifies, scores, and helps you win government and private sector contracts across Canada, the US, and internationally.

## Four Revenue Streams

1. **Win Government Contracts** — Federal, provincial, MASH sector (municipalities, universities, hospitals)
2. **Private Sector AI Services** — B2B retainers for document processing, content creation, data analysis
3. **Bid Writing as a Service** — AI-generated proposals at $3K-$15K per bid
4. **SaaS Platform Licensing** — Sell the scanning/scoring/bidding tool to other contractors

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Database:** Supabase (Postgres + Auth + Edge Functions)
- **UI:** Tailwind CSS + shadcn/ui
- **AI:** Anthropic Claude API (classification, scoring, bid generation)
- **Payments:** Stripe (subscription billing)
- **Deployment:** Vercel (cron jobs, edge functions, preview deploys)
- **Email:** Resend (alert notifications)

## Getting Started

### Prerequisites

- Node.js 18+
- npm
- Supabase account (free tier works)
- Anthropic API key
- Stripe account (for payments)

### 1. Install Dependencies

```bash
cd govbot-app
npm install
```

### 2. Configure Environment

Copy `.env.local` and fill in your values:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Stripe
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_SCOUT=price_...      # Stripe price ID for Scout plan
STRIPE_PRICE_PRO=price_...        # Stripe price ID for Pro plan
STRIPE_PRICE_ENTERPRISE=price_... # Stripe price ID for Enterprise plan

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
CRON_SECRET=your_random_secret

# Email
RESEND_API_KEY=re_...

# Data Sources (optional — leave blank to skip)
MERX_FEED_URL=               # MERX XML/JSON feed URL (subscription required)
SAM_GOV_API_KEY=             # SAM.gov API key (free — register at sam.gov)
```

### 3. Set Up Database

Run these SQL files in your Supabase SQL Editor, in order:

1. `supabase/schema.sql` — Core tables
2. `supabase/migrations-v2.sql` — Bookmark/pipeline tracking

This creates:

- `profiles` — User accounts with plan tiers
- `tenders` — Classified tender opportunities
- `award_notices` — Historical contract awards
- `bid_responses` — Generated bid documents
- `alert_preferences` — User notification settings
- `saved_tenders` — Bookmarked tenders with pipeline stages
- `refresh_log` — Data pipeline audit log
- Views: `top_vendors`, `department_spending`

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The app works in **demo mode** with mock data when Supabase is not configured. All features are functional with sample tenders.

### 5. Deploy to Vercel

```bash
npx vercel
```

The `vercel.json` configures a cron job that refreshes CanadaBuys data every 2 hours.

## Project Structure

```
govbot-app/
├── src/
│   ├── app/
│   │   ├── page.tsx                 # Dashboard
│   │   ├── pipeline/page.tsx        # Pipeline view
│   │   ├── analytics/page.tsx       # Award history & intelligence
│   │   ├── bid-generator/page.tsx   # AI bid response generator
│   │   ├── sources/page.tsx         # Data sources & pipeline
│   │   ├── pricing/page.tsx         # SaaS pricing tiers
│   │   ├── login/page.tsx           # Auth: login
│   │   ├── signup/page.tsx          # Auth: signup
│   │   └── api/
│   │       ├── cron/refresh/        # CanadaBuys data refresh
│   │       ├── tenders/             # Tender CRUD
│   │       ├── classify/            # AI classification
│   │       ├── bid-generate/        # AI bid generation
│   │       └── webhooks/stripe/     # Subscription billing
│   ├── components/
│   │   ├── ui/                      # shadcn/ui components
│   │   ├── layout/                  # Navigation, layout
│   │   ├── dashboard/               # Stats, filters, tender list
│   │   └── pipeline/                # Tender detail panel
│   ├── lib/
│   │   ├── constants.ts             # Categories, sources, pricing
│   │   ├── scoring.ts               # Opportunity scoring engine
│   │   ├── csv-parser.ts            # CanadaBuys CSV parser
│   │   ├── claude.ts                # Claude API integration
│   │   ├── mock-data.ts             # Demo/seed data
│   │   ├── utils.ts                 # Utilities
│   │   └── supabase/                # Supabase client/server
│   └── types/
│       └── tender.ts                # TypeScript type definitions
├── supabase/
│   └── schema.sql                   # Database schema
├── vercel.json                      # Cron job config
└── .env.local                       # Environment variables
```

## Data Sources

| Source | Status | Endpoint |
|--------|--------|----------|
| CanadaBuys (Federal) | Live | CSV refreshed every 2 hours |
| MERX (Multi-level) | Planned | Subscription API |
| BC Bid | Planned | Web scraping |
| Supply Ontario | Planned | API (coming from ON govt) |
| SAM.gov (US Federal) | Coming Soon | Free public API |
| UNGM (United Nations) | Coming Soon | Procurement portal |

## Key Registration Steps

1. **Get a CRA Business Number** — Required for procurement registration
2. **Register on CanadaBuys** — Create SAP Ariba account
3. **Get PBN** — Register in Supplier Registration Information system
4. **AI Source List ITQ** — Apply at WS4286933967 (open until Sept 2026)
5. **IRAP Funding** — Call 1-877-994-4727 for AI Assist program (up to $1M grant)

## License

Proprietary. All rights reserved.

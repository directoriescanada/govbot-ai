-- ═══════════════════════════════════════════════════════════════════
-- GovBot AI — Combined Schema (run this once in Supabase SQL Editor)
-- ═══════════════════════════════════════════════════════════════════

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ─── User Profiles ──────────────────────────────────────────────
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  company_name text default '',
  plan text default 'free' check (plan in ('free', 'scout', 'pro', 'enterprise')),
  stripe_customer_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table profiles enable row level security;

create policy "Users can view own profile"
  on profiles for select using (auth.uid() = id);

create policy "Users can update own profile"
  on profiles for update using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ─── Tenders ────────────────────────────────────────────────────
create table if not exists tenders (
  id uuid default uuid_generate_v4() primary key,
  external_id text not null,
  title text not null,
  description text default '',
  department text default '',
  category text default 'SRV',
  gsin text default '',
  closing_date timestamptz,
  publication_date timestamptz,
  estimated_value numeric default 0,
  solicitation_type text default 'RFP',
  region text default '',
  trade_agreements text[] default '{}',
  ai_categories text[] default '{}',
  ai_score integer default 0,
  competitor_count integer default 0,
  bid_complexity text default 'Medium',
  ai_fulfillment jsonb,
  source text default 'canadabuys',
  source_url text default '',
  status text default 'open',
  computed_score integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(external_id, source)
);

create index if not exists idx_tenders_source on tenders(source);
create index if not exists idx_tenders_status on tenders(status);
create index if not exists idx_tenders_ai_score on tenders(ai_score desc);
create index if not exists idx_tenders_computed_score on tenders(computed_score desc);
create index if not exists idx_tenders_closing_date on tenders(closing_date);
create index if not exists idx_tenders_estimated_value on tenders(estimated_value desc);

alter table tenders enable row level security;

-- Anyone can read tenders (no login required for browsing)
create policy "Public read access to tenders"
  on tenders for select using (true);

-- Service role can insert/update/delete
create policy "Service role full access to tenders"
  on tenders for all using (true);

-- ─── Award Notices ──────────────────────────────────────────────
create table if not exists award_notices (
  id uuid default uuid_generate_v4() primary key,
  external_id text not null,
  title text not null,
  department text default '',
  award_date timestamptz,
  vendor_name text default '',
  contract_value numeric default 0,
  category text default 'SRV',
  gsin text default '',
  source text default 'canadabuys',
  created_at timestamptz default now(),
  unique(external_id, source)
);

create index if not exists idx_awards_vendor on award_notices(vendor_name);
create index if not exists idx_awards_department on award_notices(department);
create index if not exists idx_awards_value on award_notices(contract_value desc);

alter table award_notices enable row level security;

create policy "Public read access to awards"
  on award_notices for select using (true);

create policy "Service role full access to awards"
  on award_notices for all using (true);

-- ─── Bid Responses ──────────────────────────────────────────────
create table if not exists bid_responses (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  tender_id uuid references tenders(id) on delete cascade,
  tender_title text default '',
  compliance_matrix jsonb default '[]',
  proposal_sections jsonb default '[]',
  pricing_model jsonb default '{}',
  status text default 'draft' check (status in ('draft', 'review', 'submitted')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table bid_responses enable row level security;

create policy "Users can manage own bids"
  on bid_responses for all using (auth.uid() = user_id);

-- ─── Alert Preferences ─────────────────────────────────────────
create table if not exists alert_preferences (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  min_score integer default 70,
  categories text[] default '{}',
  min_value numeric default 0,
  max_value numeric default 10000000,
  email_enabled boolean default true,
  slack_webhook text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table alert_preferences enable row level security;

create policy "Users can manage own alerts"
  on alert_preferences for all using (auth.uid() = user_id);

-- ─── Pipeline refresh log ───────────────────────────────────────
create table if not exists refresh_log (
  id uuid default uuid_generate_v4() primary key,
  source text not null,
  tenders_fetched integer default 0,
  tenders_new integer default 0,
  tenders_classified integer default 0,
  awards_fetched integer default 0,
  duration_ms integer default 0,
  error text,
  created_at timestamptz default now()
);

-- ─── Saved / Bookmarked Tenders ─────────────────────────────────
create table if not exists saved_tenders (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  tender_id uuid references tenders(id) on delete cascade not null,
  pipeline_stage text default 'interested'
    check (pipeline_stage in ('interested', 'qualifying', 'bidding', 'submitted', 'won', 'lost', 'no_bid')),
  notes text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, tender_id)
);

create index if not exists idx_saved_tenders_user on saved_tenders(user_id);
create index if not exists idx_saved_tenders_stage on saved_tenders(pipeline_stage);

alter table saved_tenders enable row level security;

create policy "Users can manage own saved tenders"
  on saved_tenders for all using (auth.uid() = user_id);

-- ─── Helper Views ───────────────────────────────────────────────

create or replace view top_vendors as
select
  vendor_name,
  count(*) as award_count,
  sum(contract_value) as total_value,
  avg(contract_value) as avg_value,
  array_agg(distinct department) as departments
from award_notices
where vendor_name != ''
group by vendor_name
order by total_value desc;

create or replace view department_spending as
select
  department,
  count(*) as contract_count,
  sum(contract_value) as total_spent,
  avg(contract_value) as avg_contract,
  max(contract_value) as max_contract
from award_notices
where department != ''
group by department
order by total_spent desc;

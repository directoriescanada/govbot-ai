-- ═══════════════════════════════════════════════════════════════════
-- GovBot AI — Schema V2: Bookmarks, Pipeline Tracking
-- Run this AFTER schema.sql
-- ═══════════════════════════════════════════════════════════════════

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

create index idx_saved_tenders_user on saved_tenders(user_id);
create index idx_saved_tenders_stage on saved_tenders(pipeline_stage);

alter table saved_tenders enable row level security;

create policy "Users can manage own saved tenders"
  on saved_tenders for all using (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════
-- GovBot AI — Phase 2: Supabase Persistence
-- Migration v3: bid_queue, contracts, user_config,
--               fulfillment_jobs, scoring_feedback
-- ═══════════════════════════════════════════════════════════════════

-- 1. Bid Queue
create table if not exists bid_queue (
  id                text primary key,
  tender_id         text not null,
  tender_title      text not null,
  department        text not null default '',
  category          text not null default '',
  estimated_value   numeric not null default 0,
  closing_date      timestamptz,
  ai_score          int not null default 0,
  bid_price         numeric not null default 0,
  margin_percent    numeric not null default 0,
  status            text not null default 'auto_drafted'
                    check (status in ('auto_drafted','reviewing','approved','exported','submitted','skipped')),
  bid_draft         jsonb,
  blockers          jsonb not null default '[]',
  created_at        timestamptz not null default now(),
  reviewed_at       timestamptz,
  exported_at       timestamptz
);

-- 2. Contracts
create table if not exists contracts (
  id                      text primary key,
  tender_id               text not null,
  external_id             text,
  title                   text not null,
  department              text not null default '',
  category                text not null default '',
  contract_value          numeric not null default 0,
  bid_price               numeric not null default 0,
  won_date                timestamptz,
  start_date              timestamptz,
  deliverable_due         timestamptz,
  deliverable_description text,
  status                  text not null default 'active'
                          check (status in ('active','in_fulfillment','delivered','invoiced','paid','closed')),
  fulfillment_job_id      text,
  invoice_number          text,
  invoice_date            timestamptz,
  paid_date               timestamptz,
  margin_percent          numeric not null default 0,
  ai_cost_actual          numeric not null default 0,
  notes                   text not null default '',
  outcome                 text check (outcome in ('won','lost')),
  outcome_notes           text,
  original_scoring_data   jsonb,
  created_at              timestamptz not null default now()
);

-- 3. User Config
create table if not exists user_config (
  user_id    text primary key,
  config     jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

-- 4. Fulfillment Jobs
create table if not exists fulfillment_jobs (
  id                text primary key,
  tender_id         text not null,
  tender_title      text not null,
  department        text not null default '',
  category          text not null default '',
  status            text not null default 'pending'
                    check (status in ('pending','running','review','delivered','invoiced')),
  brief             text,
  input_content     text,
  output            text,
  review_notes      text,
  estimated_ai_cost numeric not null default 0,
  agent_log         jsonb not null default '[]',
  created_at        timestamptz not null default now(),
  completed_at      timestamptz
);

-- 5. Scoring Feedback
create table if not exists scoring_feedback (
  id                        text primary key,
  contract_id               text,
  tender_id                 text not null,
  department                text not null default '',
  category                  text not null default '',
  original_score            int not null default 0,
  outcome                   text not null check (outcome in ('won','lost')),
  bid_price                 numeric not null default 0,
  contract_value            numeric not null default 0,
  scoring_weights_snapshot  jsonb,
  created_at                timestamptz not null default now()
);

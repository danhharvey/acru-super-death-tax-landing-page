create table if not exists public.acru_death_tax_leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  email text not null,
  phone text,
  dob date,
  address text,
  message text,
  retired_status text,
  eligibility jsonb not null default '{}'::jsonb,
  calculator jsonb not null default '{}'::jsonb,
  eligible_auto_reply jsonb,
  source text not null default 'super-death-tax-landing-page'
);

alter table public.acru_death_tax_leads enable row level security;

drop policy if exists "No public lead reads" on public.acru_death_tax_leads;
create policy "No public lead reads"
on public.acru_death_tax_leads
for select
using (false);


create table public.ap_guide_readers (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  recovery_hash text unique
);

create table public.ap_guide_sessions (
  token_hash text primary key,
  reader_id uuid not null references public.ap_guide_readers(id) on delete cascade,
  expires_at timestamptz not null
);

create table public.ap_guide_orders (
  order_id text primary key,
  reader_id uuid not null references public.ap_guide_readers(id),
  program text not null check (program in ('fat-loss', 'body-recomp', 'muscle-gain', 'bundle')),
  amount integer not null check (amount > 0),
  currency text not null check (currency = 'INR'),
  status text not null default 'pending' check (status in ('pending', 'captured', 'refunded')),
  payment_id text unique,
  created_at timestamptz not null default now()
);

create index ap_guide_sessions_reader on public.ap_guide_sessions (reader_id);
create index ap_guide_orders_reader_created on public.ap_guide_orders (reader_id, created_at desc);

alter table public.ap_guide_readers enable row level security;
alter table public.ap_guide_sessions enable row level security;
alter table public.ap_guide_orders enable row level security;

revoke all on public.ap_guide_readers, public.ap_guide_sessions, public.ap_guide_orders from public, anon, authenticated;
grant select, insert, update, delete on public.ap_guide_readers, public.ap_guide_sessions, public.ap_guide_orders to service_role;

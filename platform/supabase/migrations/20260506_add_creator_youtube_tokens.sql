-- Stores OAuth tokens for YouTube creator integration.
-- Apply in Supabase SQL editor or via your migration pipeline.

create table if not exists public.creator_youtube_tokens (
  id bigserial primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  youtube_channel_id text not null,
  access_token_encrypted text not null,
  refresh_token_encrypted text not null,
  scope text not null,
  token_type text not null default 'Bearer',
  expires_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (youtube_channel_id),
  unique (user_id, youtube_channel_id)
);

create index if not exists idx_creator_youtube_tokens_user_id
  on public.creator_youtube_tokens (user_id);

create or replace function public.set_creator_youtube_tokens_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_creator_youtube_tokens_updated_at
  on public.creator_youtube_tokens;

create trigger trg_creator_youtube_tokens_updated_at
before update on public.creator_youtube_tokens
for each row
execute function public.set_creator_youtube_tokens_updated_at();

alter table public.creator_youtube_tokens enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'creator_youtube_tokens'
      and policyname = 'creator_youtube_tokens_select_own'
  ) then
    create policy creator_youtube_tokens_select_own
      on public.creator_youtube_tokens
      for select
      using (auth.uid() = user_id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'creator_youtube_tokens'
      and policyname = 'creator_youtube_tokens_insert_own'
  ) then
    create policy creator_youtube_tokens_insert_own
      on public.creator_youtube_tokens
      for insert
      with check (auth.uid() = user_id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'creator_youtube_tokens'
      and policyname = 'creator_youtube_tokens_update_own'
  ) then
    create policy creator_youtube_tokens_update_own
      on public.creator_youtube_tokens
      for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'creator_youtube_tokens'
      and policyname = 'creator_youtube_tokens_delete_own'
  ) then
    create policy creator_youtube_tokens_delete_own
      on public.creator_youtube_tokens
      for delete
      using (auth.uid() = user_id);
  end if;
end
$$;

create table if not exists public.player_stats (
  name text primary key,
  wins integer not null default 0,
  games integer not null default 0,
  score integer not null default 0,
  updated_at timestamptz not null default now()
);

create or replace function public.record_player_result(
  p_name text,
  p_win boolean,
  p_score_delta integer
)
returns void
language plpgsql
security definer
as $$
begin
  insert into public.player_stats (name, wins, games, score, updated_at)
  values (
    p_name,
    case when p_win then 1 else 0 end,
    1,
    coalesce(p_score_delta, 0),
    now()
  )
  on conflict (name)
  do update
  set wins = public.player_stats.wins + case when p_win then 1 else 0 end,
      games = public.player_stats.games + 1,
      score = public.player_stats.score + coalesce(p_score_delta, 0),
      updated_at = now();
end;
$$;

-- First-party analytics, in the same D1 database as accounts (binding DB).
-- Staging: freecell-worlds-staging. Production: freecell-worlds.
-- There is no separate analytics database and no Queue binding.
--
-- The plan's fact tables named "session" and "account" are not created here.
-- Those names are already Better Auth tables in 0001_auth.sql. Fact rollups
-- stay a later migration and will need their own names.

-- Raw events. Ids are client UUIDs, so a retry of the same batch does not double-count.
create table "event" (
  "id" text primary key,
  "ts" integer not null,
  "received" integer not null,
  "day" text not null,
  "name" text not null,
  "session_id" text,
  "player_id" text,
  "mode" text not null check ("mode" in ('full', 'anonymous', 'server')),
  "app_version" text,
  "country" text,
  "device" text,
  "browser" text,
  "os" text,
  "ctx" text,
  "params" text not null,
  "trusted" integer not null default 0,
  "suspect" integer not null default 0,
  "internal" integer not null default 0,
  "clock_skew" integer not null default 0,
  "run_id" text generated always as (json_extract("params", '$.run_id')) virtual,
  "game_id" text generated always as (json_extract("params", '$.game_id')) virtual
);
create index "event_day_name" on "event" ("day", "name");
create index "event_player_ts" on "event" ("player_id", "ts");
create index "event_run" on "event" ("run_id") where "run_id" is not null;

-- One row per UTC day. "rejected" is a JSON object of reason -> count.
create table "ingest_stats" (
  "day" text primary key,
  "accepted" integer not null default 0,
  "rejected" text not null default '{}',
  "dedupes" integer not null default 0,
  "suspect" integer not null default 0,
  "bytes" integer not null default 0
);

-- Kill switch and sample rate served by GET /config.
-- analytics_enabled: "1" or "0". analytics_sample: "0" to "1".
create table "remote_config" (
  "key" text primary key,
  "value" text not null
);

-- Player data. Ids are UUIDs; user_id always references "user"("id"), never the email.

-- One row per synced localStorage key (js/store.js). `version` increments on every
-- write; a client must send the version it last saw, so a stale device can't overwrite.
create table "save_slot" (
  "user_id" text not null references "user" ("id") on delete cascade,
  "key" text not null,
  "data" text not null,
  "version" integer not null,
  "updated_at" integer not null,
  primary key ("user_id", "key")
);

-- Per-email failed sign-in counter (src/data.js recordSignIn).
create table "login_throttle" (
  "email" text not null primary key,
  "failures" integer not null,
  "window_start" integer not null,
  "locked_until" integer not null
);

-- Purchases (Stripe Checkout). Kept after account deletion for tax records, so the
-- user link is nulled rather than cascaded.
create table "purchase" (
  "id" text not null primary key,
  "user_id" text references "user" ("id") on delete set null,
  "provider" text not null default 'stripe',
  "provider_ref" text not null unique,
  "product" text not null,
  "tokens" integer not null,
  "amount_cents" integer not null,
  "currency" text not null,
  "status" text not null check ("status" in ('pending', 'paid', 'refunded', 'failed')),
  "created_at" integer not null,
  "updated_at" integer not null
);
create index "purchase_user_idx" on "purchase" ("user_id");

-- Theme Token balance is the sum of this ledger: +n per paid purchase, -1 per theme
-- created, +1 back if a generation fails, -n on refund.
create table "token_ledger" (
  "id" text not null primary key,
  "user_id" text not null references "user" ("id") on delete cascade,
  "delta" integer not null,
  "reason" text not null check ("reason" in ('purchase', 'theme', 'theme_refund', 'refund', 'grant')),
  "purchase_id" text references "purchase" ("id") on delete set null,
  "theme_id" text,
  "created_at" integer not null
);
create index "token_ledger_user_idx" on "token_ledger" ("user_id");

-- A player's custom theme. Generation produces up to three options; the player picks one.
create table "custom_theme" (
  "id" text not null primary key,
  "user_id" text not null references "user" ("id") on delete cascade,
  "name" text not null,
  "prompt" text not null,
  "status" text not null check ("status" in ('queued', 'generating', 'choosing', 'ready', 'rejected', 'failed', 'expired')),
  "moderation" text,
  "chosen_option" integer,
  "created_at" integer not null,
  "updated_at" integer not null
);
create index "custom_theme_user_idx" on "custom_theme" ("user_id");

-- Files for a theme option, stored in the THEME_ASSETS R2 bucket under `r2_key`.
create table "theme_asset" (
  "id" text not null primary key,
  "theme_id" text not null references "custom_theme" ("id") on delete cascade,
  "option" integer not null,
  "kind" text not null check ("kind" in ('hero', 'table', 'back', 'music')),
  "r2_key" text not null unique,
  "content_type" text not null,
  "bytes" integer not null,
  "created_at" integer not null
);
create index "theme_asset_theme_idx" on "theme_asset" ("theme_id");

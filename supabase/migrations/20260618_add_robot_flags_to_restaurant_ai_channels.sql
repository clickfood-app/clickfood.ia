alter table restaurant_ai_channels
add column if not exists is_enabled boolean not null default false;

alter table restaurant_ai_channels
add column if not exists auto_reply_enabled boolean not null default false;

alter table restaurant_ai_channels
add column if not exists phone_number text;

alter table restaurant_ai_channels
add column if not exists updated_at timestamptz not null default now;

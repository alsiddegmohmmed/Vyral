-- 0006: uploaded card images (logo, icon, stamp), stored in Postgres.
-- Small, validated raster images only (PNG/JPEG/WebP, <= 1 MB; SVG refused).
create table images (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references orgs(id) on delete cascade,
  kind        text not null check (kind in ('logo','icon','stamp')),
  mime        text not null check (mime in ('image/png','image/jpeg','image/webp')),
  bytes       bytea not null check (octet_length(bytes) <= 1048576),
  width       int not null check (width between 1 and 4096),
  height      int not null check (height between 1 and 4096),
  sha256      text not null,
  created_at  timestamptz not null default now()
);
create index images_org_idx on images (org_id, created_at desc);
alter table images enable row level security;
alter table campaigns add column if not exists logo_image_id  uuid references images(id) on delete set null;
alter table campaigns add column if not exists icon_image_id  uuid references images(id) on delete set null;
alter table campaigns add column if not exists stamp_image_id uuid references images(id) on delete set null;
create index campaigns_logo_image_idx on campaigns (logo_image_id);
create index campaigns_icon_image_idx on campaigns (icon_image_id);
create index campaigns_stamp_image_idx on campaigns (stamp_image_id);

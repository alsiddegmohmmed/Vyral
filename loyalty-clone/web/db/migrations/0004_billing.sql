-- 0004: invoices remember what they pay for (Flutterwave prepaid periods)
alter table invoices add column if not exists plan text check (plan in ('starter','growth','pro'));
alter table invoices add column if not exists billing_interval text check (billing_interval in ('month','year'));

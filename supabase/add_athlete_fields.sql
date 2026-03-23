-- Add content_rating and reach_level columns to athletes table
-- These fields support the 2026 Performance Tracker template

alter table athletes add column if not exists content_rating text;
alter table athletes add column if not exists reach_level text;

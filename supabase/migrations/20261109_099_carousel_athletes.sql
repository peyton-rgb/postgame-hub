-- ============================================================
-- 099 — carousel_athletes: who the Hub carousel editor works on.
--
-- One row per athlete in the Raising Cane's Basketball 2027 feed-carousel
-- set. frameio_selected_folder_id is the athlete's SELECTED CLIPS folder in
-- Frame.io; the content picker lists it, plus any clip marked Approved in the
-- athlete's main folder (the SELECTED folder's parent, looked up live unless
-- frameio_root_folder_id is filled in). Staff-only, like frameio_connection.
-- New table + seed rows only; nothing existing changes.
-- Applied to production (xqaybwhpgxillpbbqtks) 2026-11-09.
-- ============================================================

create table if not exists public.carousel_athletes (
  slug                        text primary key,
  name                        text not null,
  campaign                    text not null default 'Raising Cane''s Basketball 2027',
  frameio_selected_folder_id  text,
  frameio_root_folder_id      text,
  sort_order                  int not null default 0,
  created_at                  timestamptz not null default now()
);

alter table public.carousel_athletes enable row level security;

drop policy if exists carousel_athletes_staff_read on public.carousel_athletes;
create policy carousel_athletes_staff_read on public.carousel_athletes
  for select to authenticated using (public.is_postgame_staff());

insert into public.carousel_athletes (slug, name, frameio_selected_folder_id, sort_order) values
  ('addy_brown', 'Addy Brown', '66ae4883-803e-4546-ab49-fca5a51f02dc', 1),
  ('ahnay_adams', 'Ahnay Adams', '14ee7efc-b99e-4d41-b953-9a5a85f24d18', 2),
  ('amari_whiting', 'Amari Whiting', 'dfd23bef-4df3-4bfe-bdbe-0e05038a907b', 3),
  ('billy_richmond', 'Billy Richmond', '56c8bde0-fd5d-4b26-9011-2be1c0117612', 4),
  ('blake_buchanan', 'Blake Buchanan', 'dc252de1-c72d-4de9-9a24-9852ab5ffa72', 5),
  ('boogie_fland', 'Boogie Fland', '1d46eccd-b144-4118-933e-485a91ec4570', 6),
  ('connor_essegian', 'Connor Essegian', 'faf8a660-5150-4c84-ac7a-298f60c76eda', 7),
  ('cruz_davis', 'Cruz Davis', 'd6699bad-4761-4293-9ed0-7c9af7229d90', 8),
  ('daniel_jacobsen', 'Daniel Jacobsen', 'ec9d5cbb-79a9-4290-b646-42784577c76f', 9),
  ('derek_dixon', 'Derek Dixon', 'b88d8df8-6a54-473d-a682-be0f603f9f80', 10),
  ('hannah_hidalgo', 'Hannah Hidalgo', 'ff9de219-07c4-4379-a6c0-6ec11f8ca546', 11),
  ('ian_jackson', 'Ian Jackson', 'ed5f7aee-e4b5-4e20-9541-3d2bd055c2fd', 12),
  ('isaac_williams', 'Isaac Williams', 'fdba2d5a-123f-4ab4-9080-3213ab0e083e', 13),
  ('jalynn_bristow', 'Jalynn Bristow', 'b6aa10e0-cdbf-4b7a-901d-cfccc565c992', 14),
  ('janae_kent', 'Janae Kent', 'f6de9e6d-fb18-47f2-96ac-4404a733989c', 15),
  ('jermaine_o_neal_jr', 'Jermaine O''Neal Jr', 'e83bcc4b-b6dc-4e86-bea3-5b32492df848', 16),
  ('john_mobley_jr', 'John Mobley Jr', '91730b92-beef-450c-aca0-08c762768f45', 17),
  ('jordana_codio', 'Jordana Codio', '3eb9f9ae-30c8-4379-9046-c910aa7b2598', 18),
  ('kj_lewis', 'KJ Lewis', '114de9e8-4b0c-47ce-9ea2-7c572ed5e9ef', 19),
  ('karter_knox', 'Karter Knox', 'ecc7bb96-6d18-4a42-90a7-70061785ce6e', 20),
  ('kennedy_lee', 'Kennedy Lee', '3073bc75-0c56-4727-aadc-976f26847483', 21),
  ('kennedy_smith', 'Kennedy Smith', 'ba367b75-e233-4f13-a353-d9c793e0e925', 22),
  ('kylee_kitts', 'Kylee Kitts', 'c3f7fe0c-33ca-459e-bda8-8871b2f61ffc', 23),
  ('mackenzie_mgbako', 'Mackenzie Mgbako', 'df070ba8-9b5b-4bf4-8820-adb03fa9bf09', 24),
  ('madison_booker', 'Madison Booker', 'bd39686b-ad7a-429f-9a09-3493dbbdb323', 25),
  ('mercy_miller', 'Mercy Miller', 'd30df051-9849-4791-aa87-725238cbe296', 26),
  ('nic_anderson', 'Nic Anderson', '936aa217-71ec-4677-8f85-0009080e7749', 27),
  ('nylah_wilson', 'Nylah Wilson', 'e74b8183-2cbe-4f97-b22f-294da7f054b1', 28),
  ('tajianna_roberts', 'Tajianna Roberts', 'adfdb748-cb4e-4746-9480-008c24425227', 29),
  ('taryn_sides', 'Taryn Sides', 'e0943c93-639c-4cad-82b5-1cb6503e8e91', 30),
  ('taylen_kinney', 'Taylen Kinney', 'e2105a48-d662-404d-8cb7-ec501527a09a', 31),
  ('taylor_charles', 'Taylor Charles', 'e37d0b1d-b836-4c6c-acdd-5c21899f5da2', 32),
  ('trey_autry', 'Trey Autry', '0e438626-3b15-4b49-a829-f30e01d9ca82', 33),
  ('wes_enis', 'Wes Enis', 'dd0bce70-1c0d-4b36-a810-b9fddadef326', 34),
  ('zoom_diallo', 'Zoom Diallo', 'fb9cba2b-882c-4899-a0fc-e7c84db970d2', 35)
on conflict (slug) do nothing;

-- ============================================================
-- School backfill + canonicalisation on deals.athlete_school.
-- Ran against xqaybwhpgxillpbbqtks on 2026-09-09 (agent_jobs seq 40).
--
-- DATA, not schema, so it ran through execute_sql rather than a migration.
-- It is recorded here because it changed 131 live rows and the rollback
-- should live in the repo rather than only in a job report.
--
-- ROLLBACK — reverses the whole job, both the backfill and the merges:
--
--   UPDATE deals SET athlete_school = athlete_school_source;
--
-- The rollback column is filled by migration
-- 20260909155920_deals_athlete_school_source_rollback and is NOT dropped.
--
-- The mapping below is generated from src/lib/school-names.ts, which is the
-- source of truth and the guard for data that arrives later. If you edit one,
-- regenerate the other.
-- ============================================================

-- ── 0. Snapshot (idempotent; a re-run cannot overwrite the snapshot) ──
update deals
set athlete_school_source = athlete_school
where athlete_school_source is null;

-- ── 1. Backfill from an unambiguous exact-name athletes match ──
with map(raw, canon) as (values
('Alabama', 'Alabama'),
('ALABAMA', 'Alabama'),
('Arizona', 'Arizona'),
('Arizona State', 'Arizona State'),
('Auburn', 'Auburn'),
('Baylor', 'Baylor'),
('Baylor' || chr(10) || 'Restaurants in Market: 3', 'Baylor'),
('Denver', 'Denver'),
('Duke', 'Duke'),
('FAU', 'FAU'),
('Florida', 'Florida'),
('FLORIDA', 'Florida'),
('Florida State', 'Florida State'),
('FSU', 'Florida State'),
('Georgia Tech', 'Georgia Tech'),
('Gonzaga', 'Gonzaga'),
('Houston', 'Houston'),
('Illinois', 'Illinois'),
('Illinos', 'Illinois'),
('Indiana', 'Indiana'),
('Indiana University', 'Indiana'),
('Iowa', 'Iowa'),
('Iowa State', 'Iowa State'),
('Iowa State University', 'Iowa State'),
('Kansas', 'Kansas'),
('Kansas State', 'Kansas State'),
('Kansas State' || chr(10) || 'Restaurants in Market: 7', 'Kansas State'),
('Kentucky', 'Kentucky'),
('LIBERTY', 'Liberty'),
('Louisville', 'Louisville'),
('LSU', 'LSU'),
('LSU / Mariners', 'LSU'),
('Marquette', 'Marquette'),
('Maryland', 'Maryland'),
('Miami', 'Miami'),
('Michigan', 'Michigan'),
('Michigan State', 'Michigan State'),
('Mississippi State', 'Mississippi State'),
('NC State', 'NC State'),
('Nebraska', 'Nebraska'),
('North Carolina', 'North Carolina'),
('NORTH CAROLINA STATE BASKETBALL', 'NC State'),
('North Carolina State University', 'NC State'),
('Notre Dame', 'Notre Dame'),
('Ohio State', 'Ohio State'),
('Ole Miss', 'Ole Miss'),
('Oregon', 'Oregon'),
('Oregon State', 'Oregon State'),
('Penn State', 'Penn State'),
('Perdue', 'Purdue'),
('Providence', 'Providence'),
('Purdue', 'Purdue'),
('PURDUE', 'Purdue'),
('Purdue University', 'Purdue'),
('Rice', 'Rice'),
('Rutgers', 'Rutgers'),
('SOUTH CAROLINA', 'South Carolina'),
('St. Johns', 'St. John''s'),
('Stanford', 'Stanford'),
('Syracuse', 'Syracuse'),
('TAMU', 'Texas A&M'),
('Tennesse', 'Tennessee'),
('Tennessee', 'Tennessee'),
('Texas', 'Texas'),
('TEXAS', 'Texas'),
('Texas A&M', 'Texas A&M'),
('TEXAS A&M', 'Texas A&M'),
('Texas A&M University', 'Texas A&M'),
('Texas Tech', 'Texas Tech'),
('TEXAS TECH', 'Texas Tech'),
('Texas Tech University', 'Texas Tech'),
('UCLA', 'UCLA'),
('Uconn', 'UConn'),
('UConn', 'UConn'),
('UCONN', 'UConn'),
('UNC', 'North Carolina'),
('University of Alabama', 'Alabama'),
('University of Georgia', 'Georgia'),
('University of Kansas', 'Kansas'),
('University Of Kansas', 'Kansas'),
('University of Louisville', 'Louisville'),
('University Of Louisville', 'Louisville'),
('UNIVERSITY OF LOUISVILLE', 'Louisville'),
('University of Maryland', 'Maryland'),
('University of Miami', 'Miami'),
('University Of Miami', 'Miami'),
('University of Michigan', 'Michigan'),
('University Of Michigan', 'Michigan'),
('University of Nebraska', 'Nebraska'),
('UNIVERSITY OF NEBRASKA', 'Nebraska'),
('University of Notre Dame', 'Notre Dame'),
('UNIVERSITY OF NOTRE DAME', 'Notre Dame'),
('University of South Carolina', 'South Carolina'),
('University Of South Carolina', 'South Carolina'),
('UNIVERSITY OF SOUTH CAROLINA', 'South Carolina'),
('University of Texas', 'Texas'),
('UNIVERSITY OF TEXAS', 'Texas'),
('University of Washington', 'Washington'),
('USC', 'USC'),
('USF', 'USF'),
('Utah', 'Utah'),
('Vanderbilt', 'Vanderbilt'),
('Virginia', 'Virginia'),
('Washington', 'Washington')
),
missing as (
  select id, trim(lower(athlete_name)) as key from deals
  where published and status is distinct from 'archived'
    and (athlete_school is null or trim(athlete_school) = '') and athlete_name is not null
),
-- Candidates are CANONICALISED before the ambiguity test, so "Texas" and
-- "University of Texas" count as one school rather than as a conflict.
-- A raw value that is not in `map` (Tallahassee, "Florida and UCONN") is not a
-- candidate at all.
cand as (
  select m.id, map.canon from missing m
  join athletes a on trim(lower(a.name)) = m.key
  join map on map.raw = a.school
),
unambiguous as (
  select id, min(canon) as school from cand group by id having count(distinct canon) = 1
)
update deals d
set athlete_school = u.school
from unambiguous u
where d.id = u.id;

-- ── 2. Canonicalise every live row's school ──
with map(raw, canon) as (values
('Alabama', 'Alabama'),
('ALABAMA', 'Alabama'),
('Arizona', 'Arizona'),
('Arizona State', 'Arizona State'),
('Auburn', 'Auburn'),
('Baylor', 'Baylor'),
('Baylor' || chr(10) || 'Restaurants in Market: 3', 'Baylor'),
('Denver', 'Denver'),
('Duke', 'Duke'),
('FAU', 'FAU'),
('Florida', 'Florida'),
('FLORIDA', 'Florida'),
('Florida State', 'Florida State'),
('FSU', 'Florida State'),
('Georgia Tech', 'Georgia Tech'),
('Gonzaga', 'Gonzaga'),
('Houston', 'Houston'),
('Illinois', 'Illinois'),
('Illinos', 'Illinois'),
('Indiana', 'Indiana'),
('Indiana University', 'Indiana'),
('Iowa', 'Iowa'),
('Iowa State', 'Iowa State'),
('Iowa State University', 'Iowa State'),
('Kansas', 'Kansas'),
('Kansas State', 'Kansas State'),
('Kansas State' || chr(10) || 'Restaurants in Market: 7', 'Kansas State'),
('Kentucky', 'Kentucky'),
('LIBERTY', 'Liberty'),
('Louisville', 'Louisville'),
('LSU', 'LSU'),
('LSU / Mariners', 'LSU'),
('Marquette', 'Marquette'),
('Maryland', 'Maryland'),
('Miami', 'Miami'),
('Michigan', 'Michigan'),
('Michigan State', 'Michigan State'),
('Mississippi State', 'Mississippi State'),
('NC State', 'NC State'),
('Nebraska', 'Nebraska'),
('North Carolina', 'North Carolina'),
('NORTH CAROLINA STATE BASKETBALL', 'NC State'),
('North Carolina State University', 'NC State'),
('Notre Dame', 'Notre Dame'),
('Ohio State', 'Ohio State'),
('Ole Miss', 'Ole Miss'),
('Oregon', 'Oregon'),
('Oregon State', 'Oregon State'),
('Penn State', 'Penn State'),
('Perdue', 'Purdue'),
('Providence', 'Providence'),
('Purdue', 'Purdue'),
('PURDUE', 'Purdue'),
('Purdue University', 'Purdue'),
('Rice', 'Rice'),
('Rutgers', 'Rutgers'),
('SOUTH CAROLINA', 'South Carolina'),
('St. Johns', 'St. John''s'),
('Stanford', 'Stanford'),
('Syracuse', 'Syracuse'),
('TAMU', 'Texas A&M'),
('Tennesse', 'Tennessee'),
('Tennessee', 'Tennessee'),
('Texas', 'Texas'),
('TEXAS', 'Texas'),
('Texas A&M', 'Texas A&M'),
('TEXAS A&M', 'Texas A&M'),
('Texas A&M University', 'Texas A&M'),
('Texas Tech', 'Texas Tech'),
('TEXAS TECH', 'Texas Tech'),
('Texas Tech University', 'Texas Tech'),
('UCLA', 'UCLA'),
('Uconn', 'UConn'),
('UConn', 'UConn'),
('UCONN', 'UConn'),
('UNC', 'North Carolina'),
('University of Alabama', 'Alabama'),
('University of Georgia', 'Georgia'),
('University of Kansas', 'Kansas'),
('University Of Kansas', 'Kansas'),
('University of Louisville', 'Louisville'),
('University Of Louisville', 'Louisville'),
('UNIVERSITY OF LOUISVILLE', 'Louisville'),
('University of Maryland', 'Maryland'),
('University of Miami', 'Miami'),
('University Of Miami', 'Miami'),
('University of Michigan', 'Michigan'),
('University Of Michigan', 'Michigan'),
('University of Nebraska', 'Nebraska'),
('UNIVERSITY OF NEBRASKA', 'Nebraska'),
('University of Notre Dame', 'Notre Dame'),
('UNIVERSITY OF NOTRE DAME', 'Notre Dame'),
('University of South Carolina', 'South Carolina'),
('University Of South Carolina', 'South Carolina'),
('UNIVERSITY OF SOUTH CAROLINA', 'South Carolina'),
('University of Texas', 'Texas'),
('UNIVERSITY OF TEXAS', 'Texas'),
('University of Washington', 'Washington'),
('USC', 'USC'),
('USF', 'USF'),
('Utah', 'Utah'),
('Vanderbilt', 'Vanderbilt'),
('Virginia', 'Virginia'),
('Washington', 'Washington')
)
update deals d
set athlete_school = map.canon
from map
where map.raw = d.athlete_school
  and d.athlete_school is distinct from map.canon
  and d.published and d.status is distinct from 'archived';

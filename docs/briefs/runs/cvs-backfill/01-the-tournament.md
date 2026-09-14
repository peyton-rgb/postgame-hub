# The Tournament — `march-madness-mng47hvm`

Recap id `8c64e109-1b5f-40db-85fe-1b2ed6590d86`. Tracker tab `March Madness`
(gid 1968908289). Run first, per the brief.

## Filled

| field | before | after | source |
|---|---|---|---|
| `settings.quarter` | `""` | `Q1 2026` | `admin_created_on = 2026-02-02` |
| `lifecycle_status` | `closed` | `delivered` | readiness `ready = true` |
| `recap_readiness` | no rows | 1 row, `ready = true` | 21 Drive files, 64 media |

## The 8 aggregate values — nulled

Eight athlete rows carried an `ig_reel.views` that is an exact multiple of
100,000, implausible against their follower counts. Values recorded here
before the write so they are recoverable:

| athlete | followers | ig_reel.views (removed) |
|---|---|---|
| Malachi Smith | 17,400 | 8,600,000 |
| Tarris Reed | 15,000 | 8,600,000 |
| Braden Smith | 53,000 | 5,400,000 |
| Joshua Jefferson | 5,827 | 5,300,000 |
| Keaton Wagler | 8,670 | 5,200,000 |
| Olivia Olson | 9,878 | 4,400,000 |
| Raegan Beers | 7,792 | 3,900,000 |
| Christian Anderson | 26,400 | 1,200,000 |

Set to JSON `null` via `jsonb_set(metrics,'{ig_reel,views}','null')`. `post_url`
was preserved on all eight — verified in the `returning` clause.

**No total reach was recorded, and that is deliberate.** The instruction was to
record the figure in `kpi_targets` as total reach *if the tracker's campaign
total matches it*. The March Madness tab has no totals row at all, and none of
the eight figures appears anywhere in the tab — `8,600,000`, `5,400,000` and
`1,200,000` were all probed for and are absent. The condition did not fire, so
nothing was invented.

## Not filled, and why

| field | state | reason |
|---|---|---|
| `kpi_targets` | already `{cpm:13, impressions:28000000, athlete_quantity:25}` | already populated; additive-only, left alone |
| `description` | 430 chars | already populated |
| `key_takeaways` | 675 chars | already populated |
| `athletes.metrics` | unchanged | tracker has no metric values; columns from 24 on are misaligned and hold identity data |
| `media_campaigns` | already 64 links | nothing to add |

Note: `impressions: 28,000,000` in `kpi_targets` does not correspond to the
nulled figures — they sum to 42.6M — so the two are unrelated.

// Shared event data for the What's Next timeline.
// This file is the single source of truth — edit here to add/remove/tweak events.

export type EventCategory = 'college' | 'pro-sports' | 'brand-moment' | 'entertainment';

export interface TimelineEvent {
  id: string;
  name: string;
  month: number;           // 1–12
  dateLabel: string;       // Display string for 2026, e.g. "Feb 14" or "Jun 11 – Jul 19 (2026)"
  dateLabel2027?: string;  // Optional override for the 2027 render. Falls back to dateLabel.
  notIn2027?: boolean;     // If true, this event is skipped in the 2027 render (e.g. Olympics)
  emoji: string;           // Fallback icon if logo file missing
  isTentpole?: boolean;
  isQuadrennial?: boolean;
  logoFile: string | null; // Relative filename in /public/logos/events/
  category: EventCategory;
}

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

export const DAYS_IN_MONTH = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export const MONTH_ABBREV: Record<string, number> = {
  Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
  Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12,
};

export const EVENTS: TimelineEvent[] = [
  // JANUARY
  { id: 'pga-tour-kickoff',          name: 'PGA Tour Opens',             month: 1, dateLabel: 'Jan 1-4', dateLabel2027: 'Jan 7-10',          emoji: '\u26F3',           isTentpole: false, logoFile: 'pga-tour.png',                     category: 'pro-sports' },
  { id: 'nfl-wild-card',             name: 'NFL Wild Card',              month: 1, dateLabel: 'Jan 10-12', dateLabel2027: 'Jan 9-11',        emoji: '\uD83C\uDFC8',     isTentpole: false, logoFile: 'nfl-kickoff.png',                  category: 'pro-sports' },
  { id: 'golden-globes',             name: 'Golden Globes',              month: 1, dateLabel: 'Jan 11', dateLabel2027: 'Jan 10',           emoji: '\uD83C\uDFC6',     isTentpole: false, logoFile: 'golden-globes.png',                category: 'entertainment' },
  { id: 'australian-open',           name: 'Australian Open',            month: 1, dateLabel: 'Jan 18 – Feb 1', dateLabel2027: 'Jan 18-31',   emoji: '\uD83C\uDFBE',     isTentpole: false, logoFile: 'australian-open.png',              category: 'pro-sports' },
  { id: 'cfp-national-championship', name: 'CFP Championship',           month: 1, dateLabel: 'Jan 19', dateLabel2027: 'Jan 25',           emoji: '\uD83C\uDFC8',     isTentpole: true,  logoFile: 'cfp-national-championship.png',    category: 'college' },
  { id: 'sundance-film-festival',    name: 'Sundance Film Festival',     month: 1, dateLabel: 'Jan 22 – Feb 1', dateLabel2027: 'Jan 21-31',   emoji: '\uD83C\uDFAC',     isTentpole: false, logoFile: 'sundance-film-festival.png',       category: 'entertainment' },

  // FEBRUARY
  { id: 'grammys',                   name: 'Grammys',                    month: 2, dateLabel: 'Feb 1', dateLabel2027: 'Feb 7',            emoji: '\uD83C\uDFA4',     isTentpole: false, logoFile: 'grammys.png',                      category: 'entertainment' },
  { id: 'national-signing-day',      name: 'National Signing Day',       month: 2, dateLabel: 'Feb 4', dateLabel2027: 'Feb 3',            emoji: '\uD83D\uDCDD',     isTentpole: true,  logoFile: 'college-football-signing-day.png', category: 'college' },
  { id: 'winter-olympics',           name: 'Winter Olympics',            month: 2, dateLabel: 'Feb 6-22 (2026)', notIn2027: true,  emoji: '\u26F7\uFE0F',     isTentpole: false, isQuadrennial: true, logoFile: 'olympic-rings.png',          category: 'pro-sports' },
  { id: 'super-bowl',                name: 'Super Bowl',                 month: 2, dateLabel: 'Feb 8', dateLabel2027: 'Feb 14',            emoji: '\uD83C\uDFC8',     isTentpole: true,  logoFile: 'super-bowl.png',                   category: 'pro-sports' },
  { id: 'nyfw-fw26',                 name: 'NY Fashion Week (FW26)',     month: 2, dateLabel: 'Feb 12-18', dateLabel2027: 'Feb 11-17',        emoji: '\uD83D\uDC57',     isTentpole: false, logoFile: 'nyfw.png',                         category: 'entertainment' },
  { id: 'nba-all-star',              name: 'NBA All-Star Wknd',          month: 2, dateLabel: 'Feb 13-15', dateLabel2027: 'Feb 12-14',        emoji: '\uD83C\uDFC0',     isTentpole: false, logoFile: 'nba-all-star-weekend.png',         category: 'pro-sports' },
  { id: 'valentines-day',            name: "Valentine's Day",            month: 2, dateLabel: 'Feb 14', dateLabel2027: 'Feb 14',           emoji: '\uD83D\uDC9D',     isTentpole: false, logoFile: 'valentines-day.svg',                               category: 'brand-moment' },
  { id: 'daytona-500',               name: 'Daytona 500',                month: 2, dateLabel: 'Feb 15', dateLabel2027: 'Feb 21',           emoji: '\uD83C\uDFC1',     isTentpole: true,  logoFile: 'daytona-500.png',                  category: 'pro-sports' },
  { id: 'mlb-spring-training',       name: 'MLB Spring Training',        month: 2, dateLabel: 'Feb 20', dateLabel2027: 'Feb 19',           emoji: '\u26BE',           isTentpole: false, logoFile: 'mlb.png',                          category: 'pro-sports' },

  // MARCH
  { id: 'nfl-combine',               name: 'NFL Combine',                month: 3, dateLabel: 'Feb 25 – Mar 2', dateLabel2027: 'Feb 23 - Mar 1',   emoji: '\uD83C\uDFC8',     isTentpole: false, logoFile: 'nfl-combine.png',                  category: 'pro-sports' },
  { id: 'f1-season-opener',          name: 'F1 Opens',                   month: 3, dateLabel: 'Mar 8', dateLabel2027: 'Mar 7',            emoji: '\uD83C\uDFCE\uFE0F', isTentpole: false, logoFile: 'formula-1.png',                  category: 'pro-sports' },
  { id: 'spring-break',              name: 'Spring Break',               month: 3, dateLabel: 'Mar 9-22', dateLabel2027: 'Mar 8-21',         emoji: '\uD83C\uDF34',     isTentpole: false, logoFile: 'spring-break.svg',                               category: 'brand-moment' },
  { id: 'players-championship',      name: 'Players Championship',       month: 3, dateLabel: 'Mar 12-15', dateLabel2027: 'Mar 11-14',        emoji: '\u26F3',           isTentpole: false, logoFile: 'the-players-championship.png',     category: 'pro-sports' },
  { id: 'sxsw',                      name: 'SXSW',                       month: 3, dateLabel: 'Mar 12-18', dateLabel2027: 'Mar 12-18',        emoji: '\uD83C\uDFB8',     isTentpole: false, logoFile: 'sxsw.png',                         category: 'entertainment' },
  { id: 'march-madness',             name: 'March Madness',              month: 3, dateLabel: 'Mar 15 – Apr 6', dateLabel2027: 'Mar 14 - Apr 5',   emoji: '\uD83C\uDFC0',     isTentpole: true,  logoFile: 'march-madness.png',                category: 'college' },
  { id: 'ncaa-swimming',             name: 'NCAA Swimming & Diving',     month: 3, dateLabel: 'Mar 18-21', dateLabel2027: 'Mar 17-20',        emoji: '\uD83C\uDFCA',     isTentpole: false, logoFile: 'ncaa-swimming.png',                category: 'college' },
  { id: 'ncaa-wrestling',            name: 'NCAA Wrestling Championships', month: 3, dateLabel: 'Mar 19-21', dateLabel2027: 'Mar 18-20',      emoji: '\uD83E\uDD3C',     isTentpole: false, logoFile: 'ncaa-wrestling.png',               category: 'college' },
  { id: 'mlb-opening-day',           name: 'MLB Opening Day',            month: 3, dateLabel: 'Mar 26', dateLabel2027: 'Mar 25',           emoji: '\u26BE',           isTentpole: false, logoFile: 'mlb-opening-day.png',              category: 'pro-sports' },

  // APRIL
  { id: 'the-masters',               name: 'The Masters',                month: 4, dateLabel: 'Apr 9-12', dateLabel2027: 'Apr 8-11',         emoji: '\u26F3',           isTentpole: true,  logoFile: 'the-masters.png',                  category: 'pro-sports' },
  { id: 'coachella',                 name: 'Coachella',                  month: 4, dateLabel: 'Apr 10-19', dateLabel2027: 'Apr 9-18',        emoji: '\uD83C\uDF35',     isTentpole: false, logoFile: 'coachella.png',                    category: 'entertainment' },
  { id: 'nba-playoffs',              name: 'NBA Playoffs',               month: 4, dateLabel: 'Apr 18 – Jun', dateLabel2027: 'Apr 17 - Jun',     emoji: '\uD83C\uDFC0',     isTentpole: false, logoFile: 'nba-playoffs.png',                 category: 'pro-sports' },
  { id: 'nhl-playoffs',              name: 'NHL Playoffs',               month: 4, dateLabel: 'Apr 18 – Jun', dateLabel2027: 'Apr 17 - Jun',     emoji: '\uD83C\uDFD2',     isTentpole: false, logoFile: 'stanley-cup-final.png',            category: 'pro-sports' },
  { id: 'boston-marathon',           name: 'Boston Marathon',            month: 4, dateLabel: 'Apr 20', dateLabel2027: 'Apr 19',           emoji: '\uD83C\uDFC3',     isTentpole: false, logoFile: 'boston-marathon.png',              category: 'pro-sports' },
  { id: 'nfl-draft',                 name: 'NFL Draft',                  month: 4, dateLabel: 'Apr 23-25', dateLabel2027: 'Apr 22-24',        emoji: '\uD83C\uDFC8',     isTentpole: true,  logoFile: 'nfl-draft.png',                    category: 'pro-sports' },

  // MAY
  { id: 'kentucky-derby',            name: 'Kentucky Derby',             month: 5, dateLabel: 'May 2', dateLabel2027: 'May 1',            emoji: '\uD83C\uDFC7',     isTentpole: true,  logoFile: 'kentucky-derby.png',               category: 'pro-sports' },
  { id: 'met-gala',                  name: 'Met Gala',                   month: 5, dateLabel: 'May 4', dateLabel2027: 'May 3',            emoji: '\uD83D\uDC8E',     isTentpole: false, logoFile: 'met-gala.png',                     category: 'entertainment' },
  { id: 'rolling-loud',              name: 'Rolling Loud Orlando',       month: 5, dateLabel: 'May 8-10', dateLabel2027: 'May 7-9',         emoji: '\uD83C\uDFA4',     isTentpole: false, logoFile: 'rolling-loud.png',                 category: 'entertainment' },
  { id: 'graduation',                name: 'Graduation Season',          month: 5, dateLabel: 'May 9-23', dateLabel2027: 'May 8-22',         emoji: '\uD83C\uDF93',     isTentpole: false, logoFile: 'graduation.svg',                               category: 'brand-moment' },
  { id: 'mothers-day',               name: "Mother's Day",               month: 5, dateLabel: 'May 10', dateLabel2027: 'May 9',           emoji: '\uD83D\uDC90',     isTentpole: false, logoFile: 'mothers-day.svg',                               category: 'brand-moment' },
  { id: 'pga-championship',          name: 'PGA Championship',           month: 5, dateLabel: 'May 14-17', dateLabel2027: 'May 13-16',        emoji: '\u26F3',           isTentpole: false, logoFile: 'pga-championship.png',             category: 'pro-sports' },
  { id: 'ncaa-tennis-college',       name: 'NCAA Tennis Championships',  month: 5, dateLabel: 'May 15-23', dateLabel2027: 'May 14-22',        emoji: '\uD83C\uDFBE',     isTentpole: false, logoFile: 'ncaa-tennis.png',                  category: 'college' },
  { id: 'ncaa-golf-college',         name: 'NCAA Golf Championships',    month: 5, dateLabel: 'May 15-27', dateLabel2027: 'May 14-26',        emoji: '\u26F3',           isTentpole: false, logoFile: 'ncaa-golf.png',                    category: 'college' },
  { id: 'edc-las-vegas',             name: 'EDC Las Vegas',              month: 5, dateLabel: 'May 15-17', dateLabel2027: 'May 21-23',        emoji: '\uD83C\uDFA7',     isTentpole: false, logoFile: 'edc-las-vegas.png',                category: 'entertainment' },
  { id: 'nhl-conference-finals',     name: 'NHL Conf. Finals',           month: 5, dateLabel: 'May 15-31', dateLabel2027: 'May 14-30',        emoji: '\uD83C\uDFD2',     isTentpole: false, logoFile: 'stanley-cup-final.png',            category: 'pro-sports' },
  { id: 'nba-conference-finals',     name: 'NBA Conf. Finals',           month: 5, dateLabel: 'May 19-31', dateLabel2027: 'May 18-30',        emoji: '\uD83C\uDFC0',     isTentpole: false, logoFile: 'nba-playoffs.png',                 category: 'pro-sports' },
  { id: 'ncaa-lacrosse',             name: 'NCAA Lacrosse Championship', month: 5, dateLabel: 'May 23-25', dateLabel2027: 'May 22-24',        emoji: '\uD83E\uDD4D',     isTentpole: false, logoFile: 'ncaa-lacrosse.png',                category: 'college' },
  { id: 'indy-500',                  name: 'Indianapolis 500',           month: 5, dateLabel: 'May 24', dateLabel2027: 'May 30',           emoji: '\uD83C\uDFC1',     isTentpole: false, logoFile: 'indianapolis-500.png',             category: 'pro-sports' },
  { id: 'french-open',               name: 'French Open',                month: 5, dateLabel: 'May 24 – Jun 7', dateLabel2027: 'May 23 - Jun 6',   emoji: '\uD83C\uDFBE',     isTentpole: false, logoFile: 'french-open.png',                  category: 'pro-sports' },
  { id: 'memorial-day',              name: 'Memorial Day',               month: 5, dateLabel: 'May 25', dateLabel2027: 'May 31',           emoji: '\uD83C\uDDFA\uD83C\uDDF8', isTentpole: false, logoFile: 'memorial-day.svg',                       category: 'brand-moment' },

  // JUNE
  { id: 'stanley-cup-final',         name: 'Stanley Cup Final',          month: 6, dateLabel: 'Jun 3-17', dateLabel2027: 'Jun 2-16',         emoji: '\uD83C\uDFD2',     isTentpole: true,  logoFile: 'stanley-cup-final.png',            category: 'pro-sports' },
  { id: 'nba-finals',                name: 'NBA Finals',                 month: 6, dateLabel: 'Jun 4-18', dateLabel2027: 'Jun 3-17',         emoji: '\uD83C\uDFC0',     isTentpole: true,  logoFile: 'nba-finals.png',                   category: 'pro-sports' },
  { id: 'governors-ball',            name: 'Governors Ball',             month: 6, dateLabel: 'Jun 5-7', dateLabel2027: 'Jun 4-6',          emoji: '\uD83C\uDFA4',     isTentpole: false, logoFile: 'governors-ball.png',               category: 'entertainment' },
  { id: 'ncaa-track',                name: 'NCAA Outdoor Track & Field', month: 6, dateLabel: 'Jun 10-13', dateLabel2027: 'Jun 9-12',        emoji: '\uD83C\uDFC3',     isTentpole: false, logoFile: 'ncaa-track.png',                   category: 'college' },
  { id: 'fifa-world-cup',            name: 'FIFA World Cup',             month: 6, dateLabel: 'Jun 11 – Jul 19 (2026)', notIn2027: true, emoji: '\u26BD',     isTentpole: false, isQuadrennial: true, logoFile: 'fifa-world-cup.png',        category: 'pro-sports' },
  { id: 'bonnaroo',                  name: 'Bonnaroo',                   month: 6, dateLabel: 'Jun 11-14', dateLabel2027: 'Jun 10-13',        emoji: '\uD83C\uDFAA',     isTentpole: false, logoFile: 'bonnaroo.png',                     category: 'entertainment' },
  { id: 'college-world-series',      name: 'College World Series',       month: 6, dateLabel: 'Jun 12-22', dateLabel2027: 'Jun 11-21',        emoji: '\u26BE',           isTentpole: false, logoFile: 'mens-college-world-series.png',    category: 'college' },
  { id: 'us-open-golf',              name: 'U.S. Open (Golf)',           month: 6, dateLabel: 'Jun 18-21', dateLabel2027: 'Jun 17-20',        emoji: '\u26F3',           isTentpole: false, logoFile: 'us-open-golf.png',                 category: 'pro-sports' },
  { id: 'fathers-day',               name: "Father's Day",               month: 6, dateLabel: 'Jun 21', dateLabel2027: 'Jun 20',           emoji: '\uD83D\uDC54',     isTentpole: false, logoFile: 'fathers-day.svg',                               category: 'brand-moment' },
  { id: 'nba-draft',                 name: 'NBA Draft',                  month: 6, dateLabel: 'Jun 25-26', dateLabel2027: 'Jun 24-25',        emoji: '\uD83C\uDFC0',     isTentpole: false, logoFile: 'nba-draft.png',                    category: 'pro-sports' },

  // JULY
  { id: 'wimbledon',                 name: 'Wimbledon',                  month: 7, dateLabel: 'Jun 29 – Jul 12', dateLabel2027: 'Jun 28 - Jul 11',  emoji: '\uD83C\uDFBE',     isTentpole: true,  logoFile: 'wimbledon.png',                    category: 'pro-sports' },
  { id: 'july-4',                    name: 'Independence Day',           month: 7, dateLabel: 'Jul 4', dateLabel2027: 'Jul 4',            emoji: '\uD83C\uDF86',     isTentpole: false, logoFile: 'independence-day.svg',                               category: 'brand-moment' },
  { id: 'tour-de-france',            name: 'Tour de France',             month: 7, dateLabel: 'Jul 4-26', dateLabel2027: 'Jul 3-25',         emoji: '\uD83D\uDEB4',     isTentpole: false, logoFile: 'tour-de-france.png',               category: 'pro-sports' },
  { id: 'prime-day',                 name: 'Amazon Prime Day',           month: 7, dateLabel: 'Jul 14-16', dateLabel2027: 'Jul 13-15',        emoji: '\uD83D\uDCE6',     isTentpole: false, logoFile: 'prime-day.svg',                               category: 'brand-moment' },
  { id: 'summer-olympics',           name: 'Summer Olympics',            month: 7, dateLabel: 'Jul 14-30 (2028)', notIn2027: true, emoji: '\uD83C\uDFC5',     isTentpole: false, isQuadrennial: true, logoFile: 'olympic-rings.png',          category: 'pro-sports' },
  { id: 'espys',                     name: 'The ESPYs',                  month: 7, dateLabel: 'Jul 15', dateLabel2027: 'Jul 14',           emoji: '\uD83C\uDFC6',     isTentpole: false, logoFile: 'the-espys.png',                    category: 'pro-sports' },
  { id: 'the-open-championship',     name: 'The Open',                   month: 7, dateLabel: 'Jul 16-19', dateLabel2027: 'Jul 15-18',        emoji: '\u26F3',           isTentpole: false, logoFile: 'the-open-championship.png',        category: 'pro-sports' },
  { id: 'nfl-training-camp',         name: 'NFL Training Camp',          month: 7, dateLabel: 'Jul 23', dateLabel2027: 'Jul 22',           emoji: '\uD83C\uDFC8',     isTentpole: false, logoFile: 'nfl-kickoff.png',                  category: 'pro-sports' },
  { id: 'comic-con',                 name: 'Comic-Con SD',               month: 7, dateLabel: 'Jul 23-26', dateLabel2027: 'Jul 22-25',        emoji: '\uD83E\uDDB8',     isTentpole: false, logoFile: 'comic-con.png',                    category: 'entertainment' },
  { id: 'lollapalooza',              name: 'Lollapalooza',               month: 7, dateLabel: 'Jul 30 – Aug 2', dateLabel2027: 'Jul 29 - Aug 1',   emoji: '\uD83C\uDFB8',     isTentpole: false, logoFile: 'lollapalooza.png',                 category: 'entertainment' },

  // AUGUST
  { id: 'nfl-preseason',             name: 'NFL Preseason',              month: 8, dateLabel: 'Aug 6-30', dateLabel2027: 'Aug 5-29',         emoji: '\uD83C\uDFC8',     isTentpole: false, logoFile: 'nfl-kickoff.png',                  category: 'pro-sports' },
  { id: 'd23',                       name: 'D23',                        month: 8, dateLabel: 'Aug 14-16', dateLabel2027: 'Aug 13-15',        emoji: '\u2B50',           isTentpole: false, logoFile: 'd23.png',                          category: 'entertainment' },
  { id: 'back-to-school',            name: 'Back to School',             month: 8, dateLabel: 'Aug 15-30', dateLabel2027: 'Aug 14-29',        emoji: '\uD83C\uDF92',     isTentpole: true,  logoFile: 'back-to-school.svg',                               category: 'brand-moment' },
  { id: 'little-league-ws',          name: 'Little League WS',           month: 8, dateLabel: 'Aug 19-29', dateLabel2027: 'Aug 18-28',        emoji: '\uD83E\uDD4E',     isTentpole: false, logoFile: 'little-league.png',                category: 'pro-sports' },
  { id: 'cfb-week-0',                name: 'CFB Week 0',                 month: 8, dateLabel: 'Aug 22', dateLabel2027: 'Aug 21',           emoji: '\uD83C\uDFC8',     isTentpole: false, logoFile: 'college-football-week-1.png',      category: 'college' },
  { id: 'afropunk',                  name: 'Afropunk Brooklyn',          month: 8, dateLabel: 'Aug 23-24', dateLabel2027: 'Aug 22-23',        emoji: '\u270A',           isTentpole: false, logoFile: 'afropunk.png',                     category: 'entertainment' },
  { id: 'us-open-tennis',            name: 'US Open (Tennis)',           month: 8, dateLabel: 'Aug 31 – Sep 13', dateLabel2027: 'Aug 30 - Sep 12',  emoji: '\uD83C\uDFBE',     isTentpole: false, logoFile: 'us-open-tennis.png',               category: 'pro-sports' },

  // SEPTEMBER
  { id: 'labor-day',                 name: 'Labor Day',                  month: 9, dateLabel: 'Sep 7', dateLabel2027: 'Sep 6',            emoji: '\uD83D\uDEE0\uFE0F', isTentpole: false, logoFile: 'labor-day.svg',                             category: 'brand-moment' },
  { id: 'nfl-kickoff',               name: 'NFL Kickoff',                month: 9, dateLabel: 'Sep 10', dateLabel2027: 'Sep 9',           emoji: '\uD83C\uDFC8',     isTentpole: true,  logoFile: 'nfl-kickoff.png',                  category: 'pro-sports' },
  { id: 'emmys',                     name: 'Primetime Emmys',            month: 9, dateLabel: 'Sep 14', dateLabel2027: 'Sep 19',           emoji: '\uD83C\uDFC6',     isTentpole: false, logoFile: 'emmys.png',                        category: 'entertainment' },
  { id: 'ryder-cup',                 name: 'Ryder Cup',                  month: 9, dateLabel: 'Sep 25-27 (odd yrs)', dateLabel2027: 'Sep 17-19', emoji: '\u26F3',        isTentpole: false, logoFile: 'ryder-cup.png',                    category: 'pro-sports' },

  // OCTOBER
  { id: 'mlb-postseason',            name: 'MLB Postseason',             month: 10, dateLabel: 'Sep 29 – Nov 3', dateLabel2027: 'Sep 28 - Nov 2',   emoji: '\u26BE',           isTentpole: false, logoFile: 'mlb-postseason.png',               category: 'pro-sports' },
  { id: 'nhl-season-begins',         name: 'NHL Season Opens',           month: 10, dateLabel: 'Oct 7', dateLabel2027: 'Oct 6',            emoji: '\uD83C\uDFD2',     isTentpole: false, logoFile: 'nhl-all-star-game.png',            category: 'pro-sports' },
  { id: 'nba-tip-off',               name: 'NBA Tip-Off',                month: 10, dateLabel: 'Oct 20', dateLabel2027: 'Oct 19',           emoji: '\uD83C\uDFC0',     isTentpole: false, logoFile: 'nba-tip-off.png',                  category: 'pro-sports' },
  { id: 'world-series',              name: 'World Series',               month: 10, dateLabel: 'Oct 23 – Nov 3', dateLabel2027: 'Oct 22 - Nov 2',   emoji: '\u26BE',           isTentpole: true,  logoFile: 'world-series.png',                 category: 'pro-sports' },
  { id: 'halloween',                 name: 'Halloween',                  month: 10, dateLabel: 'Oct 31', dateLabel2027: 'Oct 31',           emoji: '\uD83C\uDF83',     isTentpole: true,  logoFile: 'halloween.svg',                               category: 'brand-moment' },

  // NOVEMBER
  { id: 'ncaa-field-hockey',         name: 'NCAA Field Hockey Championship', month: 11, dateLabel: 'Nov 13-15', dateLabel2027: 'Nov 12-14',   emoji: '\uD83C\uDFD1',     isTentpole: false, logoFile: 'ncaa-field-hockey.png',            category: 'college' },
  { id: 'f1-finale',                 name: 'F1 Finale',                  month: 11, dateLabel: 'Nov 20 – Dec 6', dateLabel2027: 'Nov 19 - Dec 5',   emoji: '\uD83C\uDFCE\uFE0F', isTentpole: false, logoFile: 'formula-1.png',                  category: 'pro-sports' },
  { id: 'cfb-rivalry-week',          name: 'CFB Rivalry Week',           month: 11, dateLabel: 'Nov 22-28', dateLabel2027: 'Nov 21-27',        emoji: '\uD83C\uDFC8',     isTentpole: true,  logoFile: 'college-football-rivalry-week.png',category: 'college' },
  { id: 'nfl-thanksgiving',          name: 'NFL Thanksgiving',           month: 11, dateLabel: 'Nov 26', dateLabel2027: 'Nov 25',           emoji: '\uD83C\uDFC8',     isTentpole: false, logoFile: 'nfl-kickoff.png',                  category: 'pro-sports' },
  { id: 'thanksgiving',              name: 'Thanksgiving',               month: 11, dateLabel: 'Nov 26', dateLabel2027: 'Nov 25',           emoji: '\uD83E\uDD83',     isTentpole: false, logoFile: 'thanksgiving.svg',                               category: 'brand-moment' },
  { id: 'black-friday',              name: 'Black Friday',               month: 11, dateLabel: 'Nov 27', dateLabel2027: 'Nov 26',           emoji: '\uD83D\uDECD\uFE0F', isTentpole: true,  logoFile: 'black-friday.svg',                             category: 'brand-moment' },
  { id: 'cyber-monday',              name: 'Cyber Monday',               month: 11, dateLabel: 'Nov 30', dateLabel2027: 'Nov 29',           emoji: '\uD83D\uDCBB',     isTentpole: false, logoFile: 'cyber-monday.svg',                               category: 'brand-moment' },

  // DECEMBER
  { id: 'nfl-playoff-picture',       name: 'NFL Playoff Picture',        month: 12, dateLabel: 'Dec 1-27', dateLabel2027: 'Dec 1-27',         emoji: '\uD83C\uDFC8',     isTentpole: false, logoFile: 'nfl-kickoff.png',                  category: 'pro-sports' },
  { id: 'womens-college-cup',        name: "Women's College Cup",        month: 12, dateLabel: 'Dec 4-7', dateLabel2027: 'Dec 3-6',          emoji: '\u26BD',           isTentpole: false, logoFile: 'womens-college-cup.png',           category: 'college' },
  { id: 'mens-college-cup',          name: "Men's College Cup",          month: 12, dateLabel: 'Dec 11-14', dateLabel2027: 'Dec 10-13',        emoji: '\u26BD',           isTentpole: false, logoFile: 'mens-college-cup.png',             category: 'college' },
  { id: 'army-navy-game',            name: 'Army-Navy Game',             month: 12, dateLabel: 'Dec 12', dateLabel2027: 'Dec 11',           emoji: '\uD83C\uDFC8',     isTentpole: false, logoFile: 'army-navy-game.png',               category: 'college' },
  { id: 'heisman-trophy',            name: 'Heisman Trophy',             month: 12, dateLabel: 'Dec 12', dateLabel2027: 'Dec 11',           emoji: '\uD83C\uDFC6',     isTentpole: false, logoFile: 'heisman-trophy.png',               category: 'college' },
  { id: 'cfb-bowl-season',           name: 'CFB Bowl Season',            month: 12, dateLabel: 'Dec 14 – Jan 19', dateLabel2027: 'Dec 13 - Jan 25',  emoji: '\uD83C\uDFC8',     isTentpole: false, logoFile: 'college-football-week-1.png',      category: 'college' },
  { id: 'ncaa-volleyball',           name: "NCAA Women's Volleyball",    month: 12, dateLabel: 'Dec 17-19', dateLabel2027: 'Dec 16-18',        emoji: '\uD83C\uDFD0',     isTentpole: false, logoFile: 'ncaa-volleyball.png',              category: 'college' },
  { id: 'christmas',                 name: 'Christmas',                  month: 12, dateLabel: 'Dec 25', dateLabel2027: 'Dec 25',           emoji: '\uD83C\uDF84',     isTentpole: true,  logoFile: 'christmas.svg',                               category: 'brand-moment' },
  { id: 'nba-christmas-day',         name: 'NBA Christmas',              month: 12, dateLabel: 'Dec 25', dateLabel2027: 'Dec 25',           emoji: '\uD83C\uDFC0',     isTentpole: false, logoFile: 'nba-tip-off.png',                  category: 'pro-sports' },
  { id: 'new-years-eve',             name: "New Year's Eve",             month: 12, dateLabel: 'Dec 31', dateLabel2027: 'Dec 31',           emoji: '\uD83C\uDF8A',     isTentpole: false, logoFile: 'new-years-eve.svg',                               category: 'brand-moment' },
];

// Parse the first "Mon DD" pattern out of a dateLabel. If the parsed
// start month is before the event's assigned month, clamp to day 1.
export function getStartDay(dateLabel: string, eventMonth: number): number {
  const m = dateLabel.match(/([A-Za-z]{3})\s+(\d{1,2})/);
  if (!m) return 15;
  const startMonth = MONTH_ABBREV[m[1]] || eventMonth;
  const day = parseInt(m[2], 10);
  if (startMonth === eventMonth) return day;
  if (startMonth < eventMonth) return 1;
  return 15;
}

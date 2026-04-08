// Seed the Crocs pitch page
// Usage: node scripts/seed-crocs-pitch.js

const { createClient } = require("@supabase/supabase-js");
const { readFileSync } = require("fs");

// Parse .env.local manually
const envContent = readFileSync(".env.local", "utf8");
const env = {};
envContent.split("\n").forEach((line) => {
  const [key, ...rest] = line.split("=");
  if (key && rest.length) env[key.trim()] = rest.join("=").trim();
});

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);

const CROCS_PITCH_CONTENT = {
  sections: [
    {
      type: "ticker",
      visible: true,
      items: [
        "Live \u2192 Stowers sets combine TE records \u00b7 11'3\" broad \u00b7 45.5\" vert",
        "Apr 03 \u2192 Harmon ends Texas career w/ Final Four farewell",
        "Apr 04 \u2192 Bradley & Arizona fall in Final Four to Michigan",
        "Mar 29 \u2192 Nyla Harris reaches Sweet 16 with UNC",
        "Hansbrough \u2192 enshrined, College Basketball HOF",
      ],
    },
    {
      type: "hero",
      visible: true,
      navBrand: "POSTGAME \u00d7 CROCS",
      navMeta: [
        { label: "FILE", value: "PITCH.001" },
        { label: "STATUS", value: "CONFIDENTIAL" },
        { label: "DATE", value: "APR 2026" },
      ],
      topLeft: "A pitch from Postgame, written this week",
      topRight: "Internal \u00b7 For Crocs business units",
      title:
        'Catch the<br><em>moment</em>,<br>not the<br>invoice.',
      stamp: "A pitch",
      lede: "College sports moves at the speed of a screen recording. The brands that win the next decade will be the ones who can <strong>react in hours</strong>, not quarters.",
      deckParagraphs: [
        "This deck exists because Crocs has already done some of the best college-athlete work in the country with Postgame \u2014 and most of the Crocs building doesn\u2019t know about it.",
        "What follows is a short tour of the athletes we\u2019ve moved on for you, what they\u2019re doing <em>right now</em>, and what we\u2019d build for the business units you haven\u2019t met yet.",
      ],
      stats: [
        { value: "14", label: "Athletes activated" },
        { value: "5", label: "Sports / leagues" },
        { value: "68", label: "Power 4 schools" },
        { value: "\u221e", label: "Speed-to-react" },
      ],
    },
    {
      type: "thesis",
      visible: true,
      sectionLabel: "\u00a7 01 / THESIS",
      heading: "Reactive beats <em>reserved</em>, every time.",
      bgWord: "REACT",
      paragraphs: [
        "The traditional brand-marketing calendar \u2014 quarterly briefs, six-week creative cycles, two-week legal \u2014 was built for a sports culture that moved on television\u2019s schedule. That world is gone.",
        "What\u2019s replaced it is a culture where a buzzer-beater becomes a meme by tip-off the next morning, where a Sweet 16 run rewrites a player\u2019s market value in 72 hours, and where the brand that\u2019s <em>already in the room</em> when the moment hits is the one that owns it.",
        "Postgame is built for that room. Our network of videographers, our direct relationships with athletes\u2019 camps, and a creative team that ships in days, not weeks \u2014 it\u2019s all designed around one job: <strong>be there when it matters, before anyone else can be.</strong>",
      ],
      pillars: [
        {
          label: "01 \u2014 Speed",
          text: "Brief to live content in <em>72 hours</em> when the moment demands it.",
        },
        {
          label: "02 \u2014 Network",
          text: "Local videographers at every Power 4 program. No flights, no scrambling.",
        },
        {
          label: "03 \u2014 Taste",
          text: "Creative that doesn\u2019t <em>look</em> reactive \u2014 it looks planned.",
        },
      ],
    },
    {
      type: "roster",
      visible: true,
      heading: "The athletes you\u2019ve already <em>moved on.</em>",
      metaLabel: "\u00a7 02 / TRACK RECORD",
      metaDetail: "14 names \u00b7 5 sports \u00b7 all in the news right now",
      athletes: [
        {
          number: "\u2116 01",
          tag: "LIVE",
          tagStyle: "live",
          name: "Eli Stowers",
          role: "TE \u00b7 Vanderbilt \u2192 2026 NFL Draft",
          moment:
            'Won the <b>John Mackey Award</b> (nation\u2019s best TE) and the <b>William V. Campbell Trophy</b> in the same season. Then went to the NFL Combine and broke the all-time tight-end records in the broad jump (11\'3") and vertical (45.5"). Top-50 prospect, climbing every board.',
          date: "\u2192 Active draft cycle, April 2026",
          photoUrl: "",
          size: "feature",
        },
        {
          number: "\u2116 02",
          tag: "LIVE",
          tagStyle: "live",
          name: "Rori Harmon",
          role: "PG \u00b7 Texas \u2192 2026 WNBA Draft",
          moment:
            "Closed out a five-year Texas career last weekend with a <b>second straight Final Four run</b>. Owns the program\u2019s all-time steals and assists records. Her coach made national headlines defending her legacy after her final game. WNBA Draft is later this month.",
          date: "\u2192 Final game played April 3, 2026",
          photoUrl: "",
          size: "feature",
        },
        {
          number: "\u2116 03",
          tag: "\u2605 POY",
          tagStyle: "poy",
          name: "Jaden Bradley",
          role: "G \u00b7 Arizona",
          moment:
            "<b>Big 12 Player of the Year.</b> Hit a buzzer-beater to win the conference tournament. Took Arizona to its first Final Four in 25 years.",
          date: "\u2192 April 4, 2026",
          photoUrl: "",
          size: "wide",
        },
        {
          number: "\u2116 04",
          tag: "SWEET 16",
          tagStyle: "default",
          name: "Nyla Harris",
          role: "F \u00b7 UNC (formerly Louisville)",
          moment:
            "Transferred to UNC for her senior year and made <b>All-ACC</b>. Helped the Tar Heels reach the Sweet 16 last weekend before falling to Michigan.",
          date: "\u2192 March 29, 2026",
          photoUrl: "",
          size: "wide",
        },
        {
          number: "\u2116 05",
          tag: "PRO",
          tagStyle: "default",
          name: "Dalton Knecht",
          role: "G/F \u00b7 Los Angeles Lakers",
          moment:
            "<b>SEC Player of the Year</b> at Tennessee, drafted by the Lakers 17th overall. Now in his second NBA season, scored a career-high 37 in his rookie year.",
          date: "\u2192 Active 2025-26 NBA season",
          photoUrl: "",
          size: "wide",
        },
        {
          number: "\u2116 06",
          tag: "PRO",
          tagStyle: "default",
          name: "Charlie Condon",
          role: "OF/1B \u00b7 Colorado Rockies",
          moment:
            "<b>2024 Golden Spikes winner.</b> Drafted #3 overall, tied the all-time MLB signing bonus record at $9.25M.",
          date: "\u2192 Rockies system, 2026",
          photoUrl: "",
          size: "std",
        },
        {
          number: "\u2116 07",
          tag: "PRO",
          tagStyle: "default",
          name: "Joe Milton III",
          role: "QB \u00b7 Dallas Cowboys",
          moment:
            "Tennessee QB turned Cowboys backup. Big arm, bigger national audience every time he steps on the field for America\u2019s Team.",
          date: "\u2192 Cowboys QB room, 2026",
          photoUrl: "",
          size: "std",
        },
        {
          number: "\u2116 08",
          tag: "PRO",
          tagStyle: "default",
          name: "Roman Wilson",
          role: "WR \u00b7 Pittsburgh Steelers",
          moment:
            "Michigan national champion. Steelers third-round pick entering a fresh start in Mike McCarthy\u2019s offense.",
          date: "\u2192 Steelers, 2026 season",
          photoUrl: "",
          size: "std",
        },
        {
          number: "\u2116 09",
          tag: "PRO",
          tagStyle: "default",
          name: "Devin Taylor",
          role: "OF \u00b7 Oakland Athletics",
          moment:
            "Indiana\u2019s all-time HR leader (passed Kyle Schwarber). 2nd-round pick, signed for $2.5M, climbing the A\u2019s system.",
          date: "\u2192 Single-A Stockton, 2026",
          photoUrl: "",
          size: "std",
        },
        {
          number: "\u2116 10",
          tag: "PRO",
          tagStyle: "default",
          name: "Lamont Butler",
          role: "G \u00b7 Atlanta Hawks (two-way)",
          moment:
            "Author of <b>10/10 from the field, 33 points</b> against Louisville for Kentucky. Two-way contract with the Hawks.",
          date: "\u2192 Hawks / G League, 2026",
          photoUrl: "",
          size: "std",
        },
        {
          number: "\u2116 11",
          tag: "RISING",
          tagStyle: "poy",
          name: "Dallas Wilson",
          role: "WR \u00b7 Florida",
          moment:
            'Five-star freshman. Set Florida\u2019s debut records (111 yds, 2 TD vs. #9 Texas). Returning for a "<b>revenge season</b>" in 2026.',
          date: "\u2192 Gators, 2026 season",
          photoUrl: "",
          size: "std",
        },
        {
          number: "\u2116 12",
          tag: "RISING",
          tagStyle: "poy",
          name: "Eric Dailey Jr.",
          role: "F \u00b7 UCLA",
          moment:
            "Dropped 20 in UCLA\u2019s NCAA Tournament opener. Returning for his senior year \u2014 an All-Big Ten breakout candidate.",
          date: "\u2192 UCLA, 2026-27",
          photoUrl: "",
          size: "std",
        },
        {
          number: "\u2116 13",
          tag: "RISING",
          tagStyle: "poy",
          name: "Seth Trimble",
          role: "G \u00b7 UNC",
          moment:
            "Hit the <b>game-winning three to beat Duke</b> with 0.4 seconds left \u2014 the latest game-winner in UNC vs Duke history.",
          date: "\u2192 Carolina lore, Feb 7, 2026",
          photoUrl: "",
          size: "std",
        },
        {
          number: "\u2116 14",
          tag: "LEGACY",
          tagStyle: "default",
          name: "Tyler Hansbrough",
          role: '"Psycho T" \u00b7 UNC \'09 / NBA / HOF',
          moment:
            "UNC\u2019s all-time leading scorer. National Champion. National Player of the Year. <b>College Basketball Hall of Fame.</b> Jersey in the rafters.",
          date: "\u2192 Forever a Tar Heel",
          photoUrl: "",
          size: "std",
        },
      ],
    },
    {
      type: "pullQuote",
      visible: true,
      quote:
        "Every name above made news in the last 90 days. We knew most of them before that news broke.",
      cite: "\u2014 The whole point of having a roster like this",
    },
    {
      type: "capabilities",
      visible: true,
      heading: "What Postgame actually <em>does</em>.",
      description:
        "For the Crocs business units that don\u2019t yet know us: here are the four things we\u2019re built to deliver, all under one roof and on a schedule the moment will allow.",
      items: [
        {
          index: "001",
          title: "The Network",
          description:
            "Local videographers at every Power 4 school. No flights, no per diems, no scrambling for a shooter the day before a game.",
        },
        {
          index: "002",
          title: "The Roster",
          description:
            "Direct, trusted relationships with athletes and their camps across football, basketball, and baseball \u2014 built deal by deal, not bought.",
        },
        {
          index: "003",
          title: "The Studio",
          description:
            "End-to-end creative \u2014 concept, brief, shoot, edit, deliver. Built for reactive turnarounds without the look or feel of a rushed job.",
        },
        {
          index: "004",
          title: "The Hub",
          description:
            "A custom CMS where briefs, deliverables, and rights live in one place. Crocs sees what\u2019s shipping, when, and from whom \u2014 in real time.",
        },
      ],
    },
    {
      type: "ideas",
      visible: true,
      sectionTag: "\u00a7 03 / IDEAS, LOOSE BY DESIGN",
      heading: "Three things we\u2019d build, <em>now.</em>",
      description:
        "These are intentionally undercooked. They\u2019re conversation starters shaped around what\u2019s <em>already happening</em> in college sports this week \u2014 and what Postgame is positioned to react to faster than anyone Crocs is currently working with.",
      ideas: [
        {
          number: "\u2192 IDEA 01",
          name: '"The Walk-Out Pack"',
          description:
            "A drop tied to athletes\u2019 pre-game tunnel walks. Each athlete styles a Crocs SKU as part of their fit, posts the BTS, and the moment becomes the campaign. Reactive product placement at the speed of a tweet.",
          channelLabel: "CHANNEL",
          channelValue: "IG Reels \u00b7 TikTok \u00b7 Tunnel cam",
        },
        {
          number: "\u2192 IDEA 02",
          name: '"Postgame in 24"',
          description:
            "A standing program: when one of our athletes makes a moment (game-winner, draft pick, viral play), Crocs is in-feed within 24 hours with a co-branded reaction edit. No quarterly planning. Just a green-light playbook and a network ready to ship.",
          channelLabel: "CHANNEL",
          channelValue: "Always-on social \u00b7 Crocs owned",
        },
        {
          number: "\u2192 IDEA 03",
          name: '"The Draft Room"',
          description:
            "Tied to the moments athletes go pro: NBA Draft, NFL Draft, WNBA Draft, MLB Draft. A long-form content series that follows our athletes from the last college game to the first pro fitting, with Crocs as the through-line in every wardrobe moment.",
          channelLabel: "CHANNEL",
          channelValue: "YouTube \u00b7 Long-form \u00b7 Cross-sport",
        },
      ],
    },
    {
      type: "cta",
      visible: true,
      kicker: "The next moment is already on the schedule",
      heading: "Let\u2019s catch the<br><em>next one</em> together.",
      buttonText: "partnerships@pstgm.com",
      buttonHref: "mailto:partnerships@pstgm.com?subject=Crocs%20%C3%97%20Postgame",
      footerBrand: "POSTGAME",
      footerMeta: "PITCH.001 \u00b7 CONFIDENTIAL \u00b7 APRIL 2026 \u00b7 pstgm.com",
    },
  ],
};

async function seed() {
  // Find the Crocs brand
  const { data: brand } = await supabase
    .from("brands")
    .select("id")
    .ilike("name", "%crocs%")
    .single();

  if (!brand) {
    console.log("Crocs brand not found in brands table. Inserting without brand_id.");
  }

  // Check if the slug already exists
  const { data: existing } = await supabase
    .from("pitch_pages")
    .select("id")
    .eq("slug", "crocs")
    .single();

  if (existing) {
    // Update existing
    const { error } = await supabase
      .from("pitch_pages")
      .update({
        title: "Postgame \u00d7 Crocs",
        brand_id: brand?.id || null,
        status: "draft",
        content: CROCS_PITCH_CONTENT,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);

    if (error) {
      console.error("Error updating:", error.message);
    } else {
      console.log("Updated existing Crocs pitch (id:", existing.id, ")");
    }
  } else {
    // Insert new
    const { data, error } = await supabase
      .from("pitch_pages")
      .insert({
        slug: "crocs",
        title: "Postgame \u00d7 Crocs",
        brand_id: brand?.id || null,
        status: "draft",
        content: CROCS_PITCH_CONTENT,
      })
      .select()
      .single();

    if (error) {
      console.error("Error inserting:", error.message);
    } else {
      console.log("Seeded Crocs pitch (id:", data.id, ")");
    }
  }
}

seed().then(() => process.exit(0));

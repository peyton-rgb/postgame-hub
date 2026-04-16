const SCHOOL_COLORS: Record<string, string> = {
  Washington: "#4B2E83", "Texas Tech": "#CC0000", "Texas A&M": "#500000",
  Miami: "#F47321", Nebraska: "#E41C38", Indiana: "#990000", Kansas: "#0051BA",
  Louisville: "#AD0000", "Nc State": "#CC0000", "Mississippi State": "#660000",
  "Arizona State": "#8C1D40", Grambling: "#FDB913", "Georiga Tech": "#B3A369",
  "Richmond University": "#990000", "University of South Florida": "#006747",
  "Southern Mississippi University": "#FFB81C", "Loyola Marymount University": "#00205B",
  "UNC Asheville": "#003366", "Prairie View A & M University": "#4F2D7F",
  "Middle Tennessee State University": "#0066CC", "Seattle University": "#AA0000",
  "University of Miami": "#F47321", "Kennesaw State University": "#FDBB30",
  "High Point University": "#330072", "St Bonaventure University": "#6E3219",
  "Florida International University": "#002F56", "Indiana University": "#990000",
  "University of Louisville": "#AD0000", "North Carolina State University": "#CC0000",
  "University of Deleware": "#00539F", "Jackson State University": "#002147",
  // Top 50 schools
  Florida: "#0021A5", Texas: "#BF5700", UCLA: "#2774AE", "South Carolina": "#73000A",
  Alabama: "#9E1B32", "Kansas State": "#512888", Illinois: "#E84A27",
  LSU: "#461D7C", FSU: "#782F40", "Wake Forrest": "#9E7E38", Oklahoma: "#841617",
  Arizona: "#CC0033", Oregon: "#154733", "Prairie View A&M": "#510084",
  USC: "#990000", Purdue: "#CEB888", UCONN: "#000E2F",
  Auburn: "#0C2340", "Notre Dame": "#0C2340", UNC: "#7BAFD4",
  Duke: "#003087", Gonzaga: "#002967", Michigan: "#00274C", Arkansas: "#9D2235",
  Utah: "#CC0000", "Iowa State": "#C8102E", "Ole Miss": "#CE1126",
  "LSU / Mariners": "#461D7C", "FSU / Athletics": "#782F40", "Wake Forrest / Twins": "#9E7E38",
  "Oklahoma / Red Sox": "#841617", "Arizona / Rays": "#CC0033", "Alabama / Twins": "#9E1B32",
  "Oregon / Reds": "#154733", "Notre Dame / TCU": "#0C2340",
  // Additional college teams
  Kentucky: "#0033A0", "Michigan State": "#18453B", "Penn State": "#041E42",
  Stanford: "#8C1515", Tennessee: "#FF8200", Virginia: "#232D4B", Virgina: "#232D4B",
  // Pro teams
  "Chicago Bears": "#0B162A", "Virginia Tech": "#630031",
};

const ABBREVS: Record<string, string> = {
  Washington: "UW", "Texas Tech": "TTU", "Texas A&M": "TAMU",
  Miami: "MIA", Nebraska: "NEB", Indiana: "IU", Kansas: "KU",
  Louisville: "UL", "Nc State": "NCS", "Mississippi State": "MSU",
  "Arizona State": "ASU", Grambling: "GRM", "Georiga Tech": "GT",
  "Richmond University": "RU", "University of South Florida": "USF",
  "Southern Mississippi University": "USM", "Loyola Marymount University": "LMU",
  "UNC Asheville": "UNCA", "Prairie View A & M University": "PVA",
  "Middle Tennessee State University": "MTSU", "Seattle University": "SU",
  "University of Miami": "MIA", "Kennesaw State University": "KSU",
  "High Point University": "HPU", "St Bonaventure University": "SBU",
  "Florida International University": "FIU", "Indiana University": "IU",
  "University of Louisville": "UL", "North Carolina State University": "NCS",
  "University of Deleware": "DEL", "Jackson State University": "JSU",
  // Additional college teams
  Kentucky: "UK", "Michigan State": "MSU", "Penn State": "PSU",
  Stanford: "STAN", Tennessee: "TENN", Virginia: "UVA", Virgina: "UVA",
  // Pro teams
  "Chicago Bears": "CHI", "Virginia Tech": "VT",
};

// ESPN team IDs for logo CDN
const ESPN_IDS: Record<string, number> = {
  Florida: 57, Texas: 251, UCLA: 26, "South Carolina": 2579,
  Alabama: 333, "Kansas State": 2306, "Texas Tech": 2641, Illinois: 356,
  LSU: 99, FSU: 52, "Wake Forrest": 154, Oklahoma: 201,
  Arizona: 12, Oregon: 2483, "Prairie View A&M": 2504,
  USC: 30, Purdue: 2509, UCONN: 41, Washington: 264,
  Kansas: 2305, Auburn: 2, "Notre Dame": 87, UNC: 153,
  Duke: 150, Gonzaga: 2250, Michigan: 130, Arkansas: 8,
  Utah: 254, "Iowa State": 66, "Ole Miss": 145,
  Miami: 2390, Nebraska: 158, Indiana: 84, Louisville: 97,
  "Nc State": 152, "Mississippi State": 344, "Arizona State": 9,
  "Texas A&M": 245, Grambling: 2755, "Georiga Tech": 59,
  // Dual entries
  "LSU / Mariners": 99, "FSU / Athletics": 52, "Wake Forrest / Twins": 154,
  "Oklahoma / Red Sox": 201, "Arizona / Rays": 12, "Alabama / Twins": 333,
  "Oregon / Reds": 2483, "Notre Dame / TCU": 87,
  // Additional college teams
  Kentucky: 96, "Michigan State": 127, "Penn State": 213,
  Stanford: 24, Tennessee: 2633, Virginia: 258, Virgina: 258, "Virginia Tech": 259,
};

const FULL_NAMES: Record<string, string> = {
  Florida: "University of Florida", Texas: "University of Texas",
  UCLA: "University of California, Los Angeles", "South Carolina": "University of South Carolina",
  Alabama: "University of Alabama", "Kansas State": "Kansas State University",
  "Texas Tech": "Texas Tech University", Illinois: "University of Illinois",
  LSU: "Louisiana State University", FSU: "Florida State University",
  "Wake Forrest": "Wake Forest University", Oklahoma: "University of Oklahoma",
  Arizona: "University of Arizona", Oregon: "University of Oregon",
  "Prairie View A&M": "Prairie View A&M University", USC: "University of Southern California",
  Purdue: "Purdue University", UCONN: "University of Connecticut",
  Washington: "University of Washington", Kansas: "University of Kansas",
  Auburn: "Auburn University", "Notre Dame": "University of Notre Dame",
  UNC: "University of North Carolina", Duke: "Duke University",
  Gonzaga: "Gonzaga University", Michigan: "University of Michigan",
  Arkansas: "University of Arkansas", Utah: "University of Utah",
  "Iowa State": "Iowa State University", "Ole Miss": "University of Mississippi",
  Miami: "University of Miami", Nebraska: "University of Nebraska",
  Indiana: "Indiana University", Louisville: "University of Louisville",
  "Nc State": "North Carolina State University", "Mississippi State": "Mississippi State University",
  "Arizona State": "Arizona State University", "Texas A&M": "Texas A&M University",
  // Dual entries
  "LSU / Mariners": "Louisiana State University", "FSU / Athletics": "Florida State University",
  "Wake Forrest / Twins": "Wake Forest University", "Oklahoma / Red Sox": "University of Oklahoma",
  "Arizona / Rays": "University of Arizona", "Alabama / Twins": "University of Alabama",
  "Oregon / Reds": "University of Oregon", "Notre Dame / TCU": "University of Notre Dame",
  // Additional college teams
  Kentucky: "University of Kentucky", "Michigan State": "Michigan State University",
  "Penn State": "Penn State University", Stanford: "Stanford University",
  Tennessee: "University of Tennessee", Virginia: "University of Virginia",
  Virgina: "University of Virginia",
  // Pro teams
  "Chicago Bears": "Chicago Bears",
  "Virginia Tech": "Virginia Tech University",
};

// ESPN NFL team IDs for pro logo CDN
const NFL_IDS: Record<string, string> = {
  "Chicago Bears": "chi",
};

export function getSchoolLogo(school: string): string | null {
  const nflId = NFL_IDS[school];
  if (nflId) return `https://a.espncdn.com/i/teamlogos/nfl/500/${nflId}.png`;
  const id = ESPN_IDS[school];
  return id ? `https://a.espncdn.com/i/teamlogos/ncaa/500/${id}.png` : null;
}

export function getFullSchoolName(school: string): string {
  return FULL_NAMES[school] || school;
}

export function getSchoolColor(school: string): string {
  return SCHOOL_COLORS[school] || "#555";
}

export function SchoolLogo({ school, size = 32 }: { school: string; size?: number }) {
  const logo = getSchoolLogo(school);
  if (logo) {
    return (
      <img
        src={logo}
        alt={school}
        style={{ width: size, height: size }}
        className="object-contain flex-shrink-0"
      />
    );
  }
  return <SchoolBadge school={school} size={size} />;
}

export function SchoolBadge({ school, size = 28 }: { school: string; size?: number }) {
  const color = SCHOOL_COLORS[school] || "#555";
  const isDark = ["#B3A369", "#FDB913", "#FFB81C", "#FDBB30"].includes(color);
  return (
    <div
      style={{ width: size, height: size, background: color }}
      className="rounded-full flex items-center justify-center flex-shrink-0 border-2 border-white/10"
    >
      <span
        style={{ fontSize: size * 0.35, color: isDark ? "#000" : "#fff" }}
        className="font-black tracking-tight"
      >
        {ABBREVS[school] || "??"}
      </span>
    </div>
  );
}

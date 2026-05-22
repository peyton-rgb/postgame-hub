// ============================================================
// Brand Data — /clients page
//
// All brand partners organized into 3 tiers:
//   featured  — hero motion cards with campaign imagery (top 10)
//   partner   — compact cards with logo + category (~20)
//   logo      — small logo tiles in a grid (everything else)
//
// Each brand has a category for filtering, a real logo URL from
// the Supabase campaign-media bucket, and a primary brand color.
//
// To add a new brand:  just add an entry to the right tier
// array and it'll show up automatically on the /clients page.
// ============================================================

export type BrandTier = 'featured' | 'partner' | 'logo';

export type BrandCategory =
  | 'Food & Beverage'
  | 'Fashion & Retail'
  | 'Health & Beauty'
  | 'Sports & Fitness'
  | 'Entertainment'
  | 'Home & Lifestyle'
  | 'Tech & Services'
  | 'Automotive & Insurance';

export interface Brand {
  name: string;
  slug: string;             // URL-safe version — used for links + keys
  tier: BrandTier;
  category: BrandCategory;
  badge?: string;           // e.g. "Case Study" or "Multi-Year Partner"
  contentUrl?: string;      // link to portfolio / case study page
  initials: string;         // 2-3 letter abbreviation for fallback when no logo
  logoUrl?: string;         // real brand logo from Supabase storage
  primaryColor: string;     // brand's primary color for gradient backgrounds
}

// Supabase storage base for brand-kits bucket
const SB = 'https://xqaybwhpgxillpbbqtks.supabase.co/storage/v1/object/public/campaign-media/brand-kits';

// ---- Featured Tier (hero motion cards) ----

const featured: Brand[] = [
  {
    name: 'adidas',
    slug: 'adidas',
    tier: 'featured',
    category: 'Fashion & Retail',
    badge: 'Case Study',
    contentUrl: '/clients/adidas',
    initials: 'ADI',
    logoUrl: `${SB}/1774623297207-ssy19gb4.png`,
    primaryColor: '#000000',
  },
  {
    name: 'Hollister',
    slug: 'hollister',
    tier: 'featured',
    category: 'Fashion & Retail',
    badge: 'Multi-Year Partner',
    contentUrl: '/clients/hollister',
    initials: 'HCO',
    logoUrl: `${SB}/1775490767805-yyp2psva.png`,
    primaryColor: '#003087',
  },
  {
    name: 'CVS Pharmacy',
    slug: 'cvs',
    tier: 'featured',
    category: 'Health & Beauty',
    badge: 'Case Study',
    contentUrl: '/clients/cvs',
    initials: 'CVS',
    logoUrl: `${SB}/1774628383554-flt5vvlr.png`,
    primaryColor: '#CC0000',
  },
  {
    name: "McDonald's",
    slug: 'mcdonalds',
    tier: 'featured',
    category: 'Food & Beverage',
    badge: '10K+ Athletes',
    contentUrl: '/clients/mcdonalds',
    initials: 'MCD',
    logoUrl: `${SB}/9ecac2a1-1449-4daf-bc62-78fe4feb9091/primary-logo.png`,
    primaryColor: '#FFC72C',
  },
  {
    name: 'Allstate',
    slug: 'allstate',
    tier: 'featured',
    category: 'Automotive & Insurance',
    badge: 'Case Study',
    contentUrl: '/clients/allstate',
    initials: 'ALL',
    logoUrl: `${SB}/1774628495363-86wbit48.png`,
    primaryColor: '#0033A0',
  },
  {
    name: 'Crocs',
    slug: 'crocs',
    tier: 'featured',
    category: 'Fashion & Retail',
    badge: 'Case Study',
    contentUrl: '/clients/crocs',
    initials: 'CRX',
    logoUrl: `${SB}/927fdb57-232d-4c30-a05d-dd22c2427ab5/primary-Crocs_id9b4iG33n_4.svg`,
    primaryColor: '#6CBDD1',
  },
  {
    name: "Wendy's",
    slug: 'wendys',
    tier: 'featured',
    category: 'Food & Beverage',
    badge: 'Case Study',
    contentUrl: '/clients/wendys',
    initials: 'WEN',
    logoUrl: `${SB}/1775004974691-144qtjf0.png`,
    primaryColor: '#E2231A',
  },
  {
    name: 'Dove',
    slug: 'dove',
    tier: 'featured',
    category: 'Health & Beauty',
    badge: 'Case Study',
    contentUrl: '/clients/dove',
    initials: 'DOV',
    logoUrl: `${SB}/e850becc-1316-4218-9217-2831fae7aeca/primary-Dove_id9QY6vqoK_1.svg`,
    primaryColor: '#003087',
  },
  {
    name: '7-Eleven',
    slug: '7-eleven',
    tier: 'featured',
    category: 'Food & Beverage',
    badge: 'Case Study',
    contentUrl: '/clients/7-eleven',
    initials: '7E',
    logoUrl: `${SB}/1774623191208-84n7ufua.png`,
    primaryColor: '#D73F09',
  },
  {
    name: "Raising Cane's",
    slug: 'raising-canes',
    tier: 'featured',
    category: 'Food & Beverage',
    badge: 'Case Study',
    contentUrl: "https://www.home.pstgm.com/projects/raising-cane's",
    initials: 'RC',
    logoUrl: `${SB}/b4f26813-c443-4a7a-b423-1e8132d070c3/primary-logo.png`,
    primaryColor: '#FFD700',
  },
];

// ---- Partner Tier (compact cards) ----

const partners: Brand[] = [
  { name: 'C4 Energy', slug: 'c4', tier: 'partner', category: 'Food & Beverage', badge: 'Case Study', contentUrl: '/clients/c4', initials: 'C4', logoUrl: `${SB}/1774628573728-tq6aij00.png`, primaryColor: '#FF0000' },
  { name: 'Stanley', slug: 'stanley', tier: 'partner', category: 'Home & Lifestyle', contentUrl: '/clients/stanley', initials: 'STN', logoUrl: `${SB}/1774628435737-ireowg06.png`, primaryColor: '#4A7C59' },
  { name: 'Steve Madden', slug: 'steve-madden', tier: 'partner', category: 'Fashion & Retail', contentUrl: '/clients/steve-madden', initials: 'SM', logoUrl: `${SB}/1774634783077-etsp9578.png`, primaryColor: '#000000' },
  { name: 'Hey Dude', slug: 'heydude', tier: 'partner', category: 'Fashion & Retail', contentUrl: '/clients/heydude', initials: 'HD', logoUrl: `${SB}/905c1dd3-3606-4c1f-b07c-41beb9d17b05/primary-HEYDUDE_idzkfGF-fp_1.svg`, primaryColor: '#2E4A7B' },
  { name: 'Gillette', slug: 'gillette', tier: 'partner', category: 'Health & Beauty', contentUrl: '/clients/gillette', initials: 'GIL', logoUrl: `${SB}/1774631133734-k7gfmmtj.png`, primaryColor: '#003087' },
  { name: 'Goodr', slug: 'goodr', tier: 'partner', category: 'Sports & Fitness', contentUrl: '/clients/goodr', initials: 'GDR', logoUrl: `${SB}/1774631710200-nee4ybp1.png`, primaryColor: '#FF1744' },
  { name: 'Hydro Flask', slug: 'hydro-flask', tier: 'partner', category: 'Home & Lifestyle', contentUrl: '/clients/hydro-flask', initials: 'HF', logoUrl: `${SB}/1775097327329-qynxitgd.png`, primaryColor: '#1B4D3E' },
  { name: 'Reebok', slug: 'reebok', tier: 'partner', category: 'Fashion & Retail', contentUrl: '/clients/reebok', initials: 'RBK', logoUrl: `${SB}/652ea37a-8e19-48d0-b40f-4485d2c521f7/primary-Reebok_Logo_0.svg`, primaryColor: '#CC0000' },
  { name: 'CeraVe', slug: 'cerave', tier: 'partner', category: 'Health & Beauty', contentUrl: '/clients/cerave', initials: 'CV', logoUrl: `${SB}/1774629898937-mj9cmpsv.png`, primaryColor: '#003B5C' },
  { name: 'Covergirl', slug: 'covergirl', tier: 'partner', category: 'Health & Beauty', contentUrl: '/clients/covergirl', initials: 'CG', logoUrl: `${SB}/1774630064106-ro0crw1w.jpg`, primaryColor: '#E8003D' },
  { name: 'Free People Movement', slug: 'free-people-movement', tier: 'partner', category: 'Fashion & Retail', contentUrl: '/clients/free-people-movement', initials: 'FP', logoUrl: `${SB}/1774630874731-mdb1mx5y.gif`, primaryColor: '#2C2C2C' },
  { name: 'Frito-Lay', slug: 'frito-lay', tier: 'partner', category: 'Food & Beverage', contentUrl: '/clients/frito-lay', initials: 'FL', logoUrl: `${SB}/1774630632556-h2zfecx6.svg`, primaryColor: '#E31837' },
  { name: 'Urban Outfitters', slug: 'urban-outfitters', tier: 'partner', category: 'Fashion & Retail', contentUrl: '/clients/urban-outfitters', initials: 'UO', logoUrl: `${SB}/1774634489099-889f8ulk.png`, primaryColor: '#1A1A1A' },
  { name: "M&M's", slug: 'mms', tier: 'partner', category: 'Food & Beverage', contentUrl: "https://www.home.pstgm.com/projects/m%26m's-", initials: 'MM', logoUrl: `${SB}/1774633191108-i6jo77gv.png`, primaryColor: '#E31837' },
  { name: "Siggi's", slug: 'siggis', tier: 'partner', category: 'Food & Beverage', badge: 'Case Study', contentUrl: "https://www.home.pstgm.com/projects/siggi's", initials: 'SIG', logoUrl: `${SB}/1774632011476-aw3ft0io.png`, primaryColor: '#D4474B' },
  { name: 'Amazon Music', slug: 'amazon-music', tier: 'partner', category: 'Entertainment', contentUrl: '/clients/amazon-music-', initials: 'AM', logoUrl: `${SB}/1774623326696-npgg8on8.png`, primaryColor: '#0077C1' },
  { name: 'Ticketmaster', slug: 'ticketmaster', tier: 'partner', category: 'Entertainment', contentUrl: '/clients/ticketmaster-', initials: 'TM', logoUrl: `${SB}/ticketmaster-5-logo-black-and-white.png`, primaryColor: '#026CDF' },
  { name: "Dick's Sporting Goods", slug: 'dicks', tier: 'partner', category: 'Sports & Fitness', initials: 'DSG', logoUrl: `${SB}/1774630321366-652zwbs6.png`, primaryColor: '#D32F2F' },
  { name: 'Armani', slug: 'armani', tier: 'partner', category: 'Fashion & Retail', contentUrl: '/clients/armani-', initials: 'ARM', logoUrl: `${SB}/1774623342520-933lera1.png`, primaryColor: '#000000' },
  { name: 'Coach', slug: 'coach', tier: 'partner', category: 'Fashion & Retail', contentUrl: '/clients/coach', initials: 'COA', logoUrl: `${SB}/1775097515402-8b88bwf4.png`, primaryColor: '#8B6F47' },
];

// ---- Logo Wall Tier (small tiles) ----

const logoWall: Brand[] = [
  { name: '1-800-Flowers', slug: '1-800-flowers', tier: 'logo', category: 'Home & Lifestyle', contentUrl: '/clients/1-800-flowers-', initials: '1800', primaryColor: '#393996' },
  { name: 'Bero', slug: 'bero', tier: 'logo', category: 'Food & Beverage', contentUrl: '/clients/bero', initials: 'BRO', logoUrl: `${SB}/1774628924676-9919zcd0.png`, primaryColor: '#1A1A1A' },
  { name: 'Brooks', slug: 'brooks', tier: 'logo', category: 'Sports & Fitness', initials: 'BRK', logoUrl: `${SB}/2c10f2b9-36e1-4bfe-bcaa-ce81e09eda5d/primary-Brooks_Running_id2jzRhPpF_2.svg`, primaryColor: '#0066CC' },
  { name: 'CAVA', slug: 'cava', tier: 'logo', category: 'Food & Beverage', contentUrl: '/clients/cava', initials: 'CVA', logoUrl: `${SB}/1774629524863-1719i1bq.png`, primaryColor: '#E8C84B' },
  { name: 'Clarks', slug: 'clarks', tier: 'logo', category: 'Fashion & Retail', contentUrl: '/clients/clarks', initials: 'CLK', logoUrl: `${SB}/1774629975423-5d97x7zr.png`, primaryColor: '#1A1A1A' },
  { name: 'Con-Cret', slug: 'con-cret', tier: 'logo', category: 'Sports & Fitness', contentUrl: '/clients/con-cret', initials: 'CC', primaryColor: '#D73F09' },
  { name: 'DKNY', slug: 'dkny', tier: 'logo', category: 'Fashion & Retail', contentUrl: '/clients/dkny', initials: 'DK', logoUrl: `${SB}/1774630254959-5j8i68l6.jpg`, primaryColor: '#000000' },
  { name: 'DoorDash', slug: 'doordash', tier: 'logo', category: 'Food & Beverage', initials: 'DD', logoUrl: `${SB}/1774630393913-o3y0jnpo.png`, primaryColor: '#FF3008' },
  { name: 'Easton', slug: 'easton', tier: 'logo', category: 'Sports & Fitness', contentUrl: '/clients/easton', initials: 'EST', logoUrl: `${SB}/1774630472669-hvvkpr7l.png`, primaryColor: '#E31837' },
  { name: "Flamin' Hot", slug: 'flamin-hot', tier: 'logo', category: 'Food & Beverage', initials: 'FH', logoUrl: `${SB}/1774630632556-h2zfecx6.svg`, primaryColor: '#E31837' },
  { name: 'Haggar', slug: 'haggar', tier: 'logo', category: 'Fashion & Retail', contentUrl: '/clients/haggar', initials: 'HAG', primaryColor: '#1A3A5C' },
  { name: 'Harmless Harvest', slug: 'harmless-harvest', tier: 'logo', category: 'Food & Beverage', initials: 'HH', logoUrl: `${SB}/1774632866210-o5u84eod.png`, primaryColor: '#F5A623' },
  { name: 'iHerb', slug: 'iherb', tier: 'logo', category: 'Health & Beauty', contentUrl: '/clients/iherb', initials: 'iH', logoUrl: `${SB}/e5427595-c02a-48d6-8c77-f8508ad6edfb/primary-logo.png`, primaryColor: '#4CAF50' },
  { name: 'Lulus', slug: 'lulus', tier: 'logo', category: 'Fashion & Retail', contentUrl: '/clients/lulus', initials: 'LUL', logoUrl: `${SB}/1774634087326-gvg38bvt.png`, primaryColor: '#000000' },
  { name: 'Monday Haircare', slug: 'monday', tier: 'logo', category: 'Health & Beauty', contentUrl: '/clients/monday', initials: 'MON', logoUrl: `${SB}/ac65730e-84fd-4271-85d7-f794cf6e690b/primary-logo.svg`, primaryColor: '#E8D5C4' },
  { name: 'PSD Underwear', slug: 'psd-underwear', tier: 'logo', category: 'Fashion & Retail', contentUrl: '/clients/psd-underwear', initials: 'PSD', logoUrl: `${SB}/1774632753735-4qdxe0ih.webp`, primaryColor: '#000000' },
  { name: 'Rawlings', slug: 'rawlings', tier: 'logo', category: 'Sports & Fitness', contentUrl: '/clients/rawlings', initials: 'RAW', logoUrl: `${SB}/1774633380701-8q5xfkip.png`, primaryColor: '#C8102E' },
  { name: 'Ruffles', slug: 'ruffles', tier: 'logo', category: 'Food & Beverage', contentUrl: '/clients/ruffles', initials: 'RUF', logoUrl: `${SB}/1774633647837-k0n3mrks.png`, primaryColor: '#6A1A6A' },
  { name: 'Sensationnel', slug: 'sensationnel', tier: 'logo', category: 'Health & Beauty', contentUrl: '/clients/sensationnel-', initials: 'SEN', logoUrl: `${SB}/1774634622532-1wngqvdw.jpeg`, primaryColor: '#C8102E' },
  { name: "Taco John's", slug: 'taco-johns', tier: 'logo', category: 'Food & Beverage', contentUrl: "https://www.home.pstgm.com/projects/taco-john's-", initials: 'TJ', logoUrl: `${SB}/1774634874680-5539z2rf.png`, primaryColor: '#E31837' },
  { name: 'Tostitos', slug: 'tostitos', tier: 'logo', category: 'Food & Beverage', initials: 'TOS', logoUrl: `${SB}/1774634430768-xtk6fqw6.png`, primaryColor: '#E31837' },
  { name: 'Thayers', slug: 'thayers', tier: 'logo', category: 'Health & Beauty', contentUrl: '/clients/thayers-', initials: 'THY', logoUrl: `${SB}/Thayers%20346x127%20logo-v3.png`, primaryColor: '#4A7C59' },
  { name: 'TLF Apparel', slug: 'tlf', tier: 'logo', category: 'Fashion & Retail', contentUrl: '/clients/tlf', initials: 'TLF', logoUrl: `${SB}/1774634975649-v406y781.webp`, primaryColor: '#000000' },
  { name: 'Tylenol', slug: 'tylenol', tier: 'logo', category: 'Health & Beauty', initials: 'TYL', logoUrl: `${SB}/1774631767605-g2duji93.svg`, primaryColor: '#CC0000' },
  { name: '34 Heritage', slug: '34-heritage', tier: 'logo', category: 'Fashion & Retail', contentUrl: '/clients/34-hertitage-', initials: '34H', primaryColor: '#1A1A1A' },
  { name: 'BioSteel', slug: 'biosteel', tier: 'logo', category: 'Sports & Fitness', initials: 'BIO', logoUrl: `${SB}/1774629194485-bb4p23ly.png`, primaryColor: '#00B4D8' },
  { name: 'BOB Hotels', slug: 'bob-hotels', tier: 'logo', category: 'Home & Lifestyle', contentUrl: '/clients/bob-hotels-', initials: 'BOB', logoUrl: `${SB}/1774629254341-wdbu7ina.png`, primaryColor: '#1A1A1A' },
  { name: 'Focus Features', slug: 'focus-features', tier: 'logo', category: 'Entertainment', initials: 'FF', primaryColor: '#1A1A1A' },
  { name: 'Fracture', slug: 'fracture', tier: 'logo', category: 'Home & Lifestyle', contentUrl: '/clients/fracture', initials: 'FRC', logoUrl: `${SB}/1774630678138-2y3m81bm.png`, primaryColor: '#2C2C2C' },
  { name: 'Gametime', slug: 'gametime', tier: 'logo', category: 'Entertainment', initials: 'GT', primaryColor: '#00C853' },
  { name: 'Holo', slug: 'holo', tier: 'logo', category: 'Fashion & Retail', contentUrl: '/clients/holo-footwear', initials: 'HLO', logoUrl: `${SB}/1774631228641-wun2rmq4.png`, primaryColor: '#7B2FBE' },
  { name: 'Knockaround', slug: 'knockaround', tier: 'logo', category: 'Fashion & Retail', initials: 'KA', primaryColor: '#FF6B00' },
  { name: 'Momentec', slug: 'momentec', tier: 'logo', category: 'Tech & Services', initials: 'MTC', primaryColor: '#003087' },
  { name: 'Onnit', slug: 'onnit', tier: 'logo', category: 'Sports & Fitness', contentUrl: '/clients/onnit-', initials: 'ONT', logoUrl: `${SB}/1774634550655-ug5thhug.png`, primaryColor: '#000000' },
  { name: 'Quizlet', slug: 'quizlet', tier: 'logo', category: 'Tech & Services', initials: 'QZ', logoUrl: `${SB}/1774633533797-uoj0372c.png`, primaryColor: '#6B3FA0' },
  { name: "Sam's Club", slug: 'sams-club', tier: 'logo', category: 'Fashion & Retail', initials: 'SAM', primaryColor: '#0060A9' },
  { name: 'STAT Sports', slug: 'stat-sports', tier: 'logo', category: 'Sports & Fitness', contentUrl: '/clients/stat-sports', initials: 'STS', primaryColor: '#FF0000' },
  { name: 'Tangle Teezer', slug: 'tangle-teezer', tier: 'logo', category: 'Health & Beauty', initials: 'TT', primaryColor: '#FF69B4' },
  { name: 'Thigh Society', slug: 'thigh-society', tier: 'logo', category: 'Fashion & Retail', initials: 'TS', primaryColor: '#2C2C2C' },
  { name: 'York Athletics', slug: 'york-athletics', tier: 'logo', category: 'Sports & Fitness', initials: 'YA', primaryColor: '#1A1A1A' },
  { name: 'Zenni', slug: 'zenni', tier: 'logo', category: 'Health & Beauty', initials: 'ZEN', logoUrl: `${SB}/1774631439807-dppiwan3.png`, primaryColor: '#6B3FA0' },
  { name: 'Capitol Records', slug: 'capitol-records', tier: 'logo', category: 'Entertainment', initials: 'CR', primaryColor: '#1A1A1A' },
  { name: 'Universal Music Group', slug: 'umg', tier: 'logo', category: 'Entertainment', initials: 'UMG', logoUrl: `${SB}/1774635222668-sv39o2qn.avif`, primaryColor: '#1A1A1A' },
  { name: 'V Foundation', slug: 'v-foundation', tier: 'logo', category: 'Entertainment', contentUrl: '/clients/the-v-foundation', initials: 'VF', primaryColor: '#1A1A1A' },
  { name: "Dr. Scholl's", slug: 'dr-scholls', tier: 'logo', category: 'Health & Beauty', initials: 'DS', logoUrl: `${SB}/7dc2e691-34c6-46f5-a5a3-51df0af8683d/primary-Dr-_Scholl's_idDjox9cTR_2.png`, primaryColor: '#0057A8' },
  { name: 'Verb', slug: 'verb', tier: 'logo', category: 'Health & Beauty', contentUrl: '/clients/verb', initials: 'VRB', primaryColor: '#FF6B00' },
  { name: 'Yesly Water', slug: 'yesly-water', tier: 'logo', category: 'Food & Beverage', contentUrl: '/clients/yesly-water', initials: 'YW', logoUrl: `${SB}/1774635137143-m7oxw336.png`, primaryColor: '#00B4D8' },
  { name: 'Whoop', slug: 'whoop', tier: 'logo', category: 'Sports & Fitness', initials: 'WHP', logoUrl: `${SB}/1777470832849-koolc5h5.webp`, primaryColor: '#000000' },
  { name: 'Taco Bell', slug: 'taco-bell', tier: 'logo', category: 'Food & Beverage', initials: 'TB', logoUrl: `${SB}/1774634836968-429oa1e2.png`, primaryColor: '#7B2B8E' },
  { name: 'Walmart', slug: 'walmart', tier: 'logo', category: 'Fashion & Retail', initials: 'WM', logoUrl: `${SB}/1774631573398-g5tc3eta.png`, primaryColor: '#0071DC' },
  { name: 'Slate Milk', slug: 'slate', tier: 'logo', category: 'Food & Beverage', initials: 'SLT', logoUrl: `${SB}/1774634727894-v0v456y8.png`, primaryColor: '#2C2C2C' },
  { name: 'Sony Music', slug: 'sony-music', tier: 'logo', category: 'Entertainment', initials: 'SNY', logoUrl: `${SB}/1774633424654-chzsvvth.png`, primaryColor: '#1A1A1A' },
  { name: 'PepsiCo', slug: 'pepsico', tier: 'logo', category: 'Food & Beverage', initials: 'PEP', logoUrl: `${SB}/1774631889012-slmltuek.png`, primaryColor: '#004B93' },
  { name: 'PAPATUI', slug: 'papatui', tier: 'logo', category: 'Health & Beauty', initials: 'PPT', logoUrl: `${SB}/6c30c5f3-32c1-4e6e-9f6d-f68b4adef52a/primary-PAPATUI_id1LDCzV7s_1.svg`, primaryColor: '#1A1A2E' },
  { name: 'AT&T', slug: 'att', tier: 'logo', category: 'Tech & Services', initials: 'ATT', logoUrl: `${SB}/1774628702434-oyljgdzd.png`, primaryColor: '#009FDB' },
  { name: 'Buckle', slug: 'buckle', tier: 'logo', category: 'Fashion & Retail', initials: 'BKL', logoUrl: `${SB}/1774629482328-qy1su11r.jpeg`, primaryColor: '#1A1A1A' },
  { name: "Scooter's Coffee", slug: 'scooters-coffee', tier: 'logo', category: 'Food & Beverage', initials: 'SC', logoUrl: `${SB}/1774633704619-6c1h651f.png`, primaryColor: '#C8102E' },
  { name: 'Cricket Wireless', slug: 'cricket-wireless', tier: 'logo', category: 'Tech & Services', initials: 'CW', logoUrl: `${SB}/1774630147770-p4p35tkt.jpg`, primaryColor: '#6B3FA0' },
];

// ---- Exports ----

/** All brands, all tiers combined */
export const allBrands: Brand[] = [...featured, ...partners, ...logoWall];

/** Just the featured tier */
export const featuredBrands: Brand[] = featured;

/** Just the partner tier */
export const partnerBrands: Brand[] = partners;

/** Just the logo wall tier */
export const logoWallBrands: Brand[] = logoWall;

/** Look up a single brand by its URL slug */
export function getBrandBySlug(slug: string): Brand | undefined {
  return allBrands.find((b) => b.slug === slug);
}

/** All unique categories for the filter bar */
export const brandCategories: BrandCategory[] = [
  'Food & Beverage',
  'Fashion & Retail',
  'Health & Beauty',
  'Sports & Fitness',
  'Entertainment',
  'Home & Lifestyle',
  'Tech & Services',
  'Automotive & Insurance',
];

// Fixed list of activation lanes Postgame offers. The FutureOpportunities
// component renders one card per item. Edit copy here; layout lives in the
// component. (Same pattern as src/data/events.ts.)

export interface Opportunity {
  title: string;
  blurb: string;
  isNew?: boolean;
}

export const OPPORTUNITIES: Opportunity[] = [
  { title: 'Rapid-Response Campaigns',         blurb: 'Dozens of athletes live in days.' },
  { title: 'Premium Creative & Production',    blurb: 'Studio-grade shoots and edits.' },
  { title: 'Events & Retail Activation',       blurb: 'Show up where fans gather.' },
  { title: 'Retail Partnerships',              blurb: 'Content tied to stores.' },
  { title: 'Team & Program Collabs',           blurb: 'Full rosters, not just individuals.' },
  { title: 'Always-On Ambassadors',            blurb: 'Year-round athlete partners.' },
  { title: 'Paid Media & Distribution',        blurb: 'Top content behind paid spend.' },
  { title: 'Venue, Broadcast & Display',       blurb: 'Arenas, broadcast, out-of-home.' },
  { title: 'Gifting & Product Seeding',        blurb: "Product in athletes' hands early." },
  { title: 'Affiliate & Revenue Partnerships', blurb: 'Trackable links tied to sales.' },
];

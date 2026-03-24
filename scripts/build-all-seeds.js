// This script generates the complete seed data from a structured format
// We'll define all records inline since the raw parser approach requires the full raw text

const records = [
  { wix_id: "0154b54d-2006-4167-9e20-5600cdd64965", status: "PUBLISHED", player_name: "Eli Stowers", college_name: "Vanderbilt", title: "2026 NFL Draft Prospect Eli Stowers Gifts Vanderbilt Teammates Crocs in Postgame Activation", image_url: "wix:__image://v1/ba5ed8_a736ea3c6044484eb7120db2bdd18d46~mv2.jpg/img.jpg#originWidth=1138&originHeight=1138__", video_url: "wix:__video://v1/ba5ed8_eea46b3927d54135ade23120e9c0173b/vid.mp4#posterUri=ba5ed8_eea46b3927d54135ade23120e9c0173bf000.jpg&posterWidth=1080&posterHeight=1920__", date: "2025-12-05", slug: "2026-nfl-draft-prospect-eli-stowers-gifts-vanderbilt-teammates-crocs-in-postgame-activation", sport_tags: ["Football"], brand_tags: ["Crocs"], industry_tags: ["Footwear"], campaign_types: ["Elevated","Team"], case_study: false, college_display: "", publish_date: "2026-02-05T20:39:03Z", created_at: "2026-02-05T20:47:09Z", updated_at: "2026-02-05T20:47:09Z" },
];

console.log(`Found ${records.length} test records`);

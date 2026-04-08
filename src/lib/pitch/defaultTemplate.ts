import type { PitchSectionData } from "@/types/pitch";

export function getDefaultPitchSections(): PitchSectionData[] {
  return [
    {
      type: "ticker",
      visible: true,
      items: [
        "Headline goes here",
        "Another headline",
        "Key stat or moment",
        "Breaking news item",
        "Athlete update",
      ],
    },
    {
      type: "hero",
      visible: true,
      navBrand: "POSTGAME \u00d7 BRAND",
      navMeta: [
        { label: "FILE", value: "PITCH.001" },
        { label: "STATUS", value: "CONFIDENTIAL" },
        { label: "DATE", value: "APR 2026" },
      ],
      topLeft: "A pitch from Postgame, written this week",
      topRight: "Internal",
      title: "Your<br><em>headline</em><br>goes here.",
      stamp: "A pitch",
      lede: "A compelling one-liner about why this partnership matters and what makes it <strong>urgent</strong>.",
      deckParagraphs: [
        "Opening paragraph explaining the relationship and context.",
        "Second paragraph setting up what the reader will see next.",
      ],
      stats: [
        { value: "0", label: "Key metric" },
        { value: "0", label: "Another metric" },
        { value: "0", label: "Third metric" },
        { value: "\u221e", label: "Aspirational metric" },
      ],
    },
    {
      type: "thesis",
      visible: true,
      sectionLabel: "\u00a7 01 / THESIS",
      heading: "Your thesis <em>headline</em> here.",
      bgWord: "REACT",
      paragraphs: [
        "Main thesis paragraph explaining the market shift or opportunity.",
        "Supporting paragraph with evidence or context.",
        "Closing paragraph with Postgame\u2019s value proposition. <strong>The key takeaway in bold.</strong>",
      ],
      pillars: [
        { label: "01 \u2014 Pillar One", text: "Description of first pillar with <em>emphasis</em>." },
        { label: "02 \u2014 Pillar Two", text: "Description of second pillar." },
        { label: "03 \u2014 Pillar Three", text: "Description of third pillar." },
      ],
    },
    {
      type: "roster",
      visible: true,
      heading: "The athletes <em>headline.</em>",
      metaLabel: "\u00a7 02 / TRACK RECORD",
      metaDetail: "0 names \u00b7 0 sports",
      athletes: [],
    },
    {
      type: "pullQuote",
      visible: true,
      quote: "Your pull quote goes here \u2014 something that captures the essence of the pitch.",
      cite: "\u2014 Attribution line",
    },
    {
      type: "capabilities",
      visible: true,
      heading: "What Postgame actually <em>does</em>.",
      description: "A brief explanation of capabilities for the audience that doesn\u2019t yet know Postgame.",
      items: [
        { index: "001", title: "The Network", description: "Description of the network capability." },
        { index: "002", title: "The Roster", description: "Description of the roster capability." },
        { index: "003", title: "The Studio", description: "Description of the studio capability." },
        { index: "004", title: "The Hub", description: "Description of the hub capability." },
      ],
    },
    {
      type: "ideas",
      visible: true,
      sectionTag: "\u00a7 03 / IDEAS, LOOSE BY DESIGN",
      heading: "Three things we\u2019d build, <em>now.</em>",
      description: "These are intentionally undercooked. They\u2019re conversation starters shaped around what\u2019s <em>already happening</em>.",
      ideas: [
        {
          number: "\u2192 IDEA 01",
          name: "\"Idea Name\"",
          description: "Description of the first idea.",
          channelLabel: "CHANNEL",
          channelValue: "Channels here",
        },
        {
          number: "\u2192 IDEA 02",
          name: "\"Idea Name\"",
          description: "Description of the second idea.",
          channelLabel: "CHANNEL",
          channelValue: "Channels here",
        },
        {
          number: "\u2192 IDEA 03",
          name: "\"Idea Name\"",
          description: "Description of the third idea.",
          channelLabel: "CHANNEL",
          channelValue: "Channels here",
        },
      ],
    },
    {
      type: "cta",
      visible: true,
      kicker: "The next moment is already on the schedule",
      heading: "Let\u2019s catch the<br><em>next one</em> together.",
      buttonText: "partnerships@pstgm.com",
      buttonHref: "mailto:partnerships@pstgm.com",
      footerBrand: "POSTGAME",
      footerMeta: "PITCH.001 \u00b7 CONFIDENTIAL \u00b7 pstgm.com",
    },
  ];
}

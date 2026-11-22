export const services = [
  {
    id: 'branding',
    title: 'Brand & launch campaigns',
    items: [
      { name: 'Brand identity', description: 'Find a clear visual direction with a logo, colors, typography and a brand kit your team can use.' },
      { name: 'Launch campaigns', description: 'Build a campaign around a new brand, product or offer, with creative for launch day and the follow-up.' },
    ],
  },
  {
    id: 'social-content',
    title: 'Social content & ads',
    items: [
      { name: 'Social media content and reels', description: 'Get a content plan, captions, graphics and short videos for the channels your customers use.' },
      { name: 'Instagram and Facebook ads', description: 'Develop Meta campaigns with creative variants, audience targeting and retargeting.' },
    ],
  },
  {
    id: 'search',
    title: 'Search, Maps & AI answers',
    items: [
      { name: 'Google Search and Maps', description: 'Improve your website and Google Business Profile so customers can find accurate services, hours and directions.' },
      { name: 'AI search visibility', description: 'Make business details clear and consistent across the pages AI tools use to answer local questions.' },
      { name: 'Google Ads', description: 'Run paid search campaigns aimed at people already looking for what you offer.' },
    ],
  },
  {
    id: 'customer-journeys',
    title: 'Websites, WhatsApp & email',
    items: [
      { name: 'Websites and landing pages', description: 'Give campaign and search traffic a clear page with one next step, like asking for a quote or booking a visit.' },
      { name: 'WhatsApp Business flows', description: 'Set up a catalog, quick replies and simple routes for ordering, booking and handling common questions.' },
      { name: 'Email campaigns', description: 'Create launch, follow-up and retention emails with a clear reason for customers to act.' },
    ],
  },
  {
    id: 'menu-catalog',
    title: 'Menus & catalogs',
    items: [
      { name: 'Digital menus and product catalogs', description: 'Send your phone photos and product details. We clean up the images and lay out a menu or catalog for your sales channels.' },
      { name: 'QR menus', description: 'Give customers a QR code linked to a menu they can open on their phones.' },
    ],
  },
];

export const questions = [
  {
    "key": "brand",
    "label": "a consistent brand",
    "question": "Does your brand look the same on every post, sign and page?",
    "hint": "Logo, colours and tone, used the same way everywhere.",
    "reason": "A brand that looks different everywhere is harder to remember and to trust.",
    "action": "We'd build one logo, colour and type kit and roll it out everywhere."
  },
  {
    "key": "posting",
    "label": "posting every week",
    "question": "Do you post on social media at least once a week?",
    "hint": "On the platforms your customers actually use.",
    "reason": "When a page goes quiet, people assume the business has too.",
    "action": "We'd plan a month of posts and reels and keep you on schedule."
  },
  {
    "key": "maps",
    "label": "showing up on Google Maps",
    "question": "Do you show up on Google Maps when people search for what you sell?",
    "hint": "Try searching your category plus \"Kigali\".",
    "reason": "People searching for what you sell nearby find someone else first.",
    "action": "We'd claim and fill in your Google Maps listing: photos, hours and what you sell."
  },
  {
    "key": "ai",
    "label": "being named in AI answers",
    "question": "If someone asks an AI assistant like ChatGPT for the best place like yours in Kigali, does it name you?",
    "hint": "Not sure counts as not yet. It's one of the newest ways people find businesses.",
    "reason": "People who ask an assistant where to go won't hear your name.",
    "action": "We'd make sure the pages AI assistants read describe you clearly and name your area."
  },
  {
    "key": "whatsapp",
    "label": "ordering on WhatsApp",
    "question": "Can a customer order or book with you on WhatsApp in under a minute?",
    "hint": "A catalog, quick replies and a clear way to pay.",
    "reason": "Every extra step between hello and order is a chance to lose the sale.",
    "action": "We'd set up your catalog, quick replies and a simple way to order or book."
  }
];
export const priority = [2,4,1,0,3];
export const whatsapp = "250780586157";
export const whatsappDisplay = "+250 780 586 157";
export const email = "vyralrwanda@gmail.com";
export const instagram = { handle: "@vyral.rw", url: "https://www.instagram.com/vyral.rw/" };
export function chatLink(message: string) {
  return `https://wa.me/${whatsapp}?text=${encodeURIComponent(message)}`;
}

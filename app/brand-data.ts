export const services = [
  {
    "title": "be remembered",
    "items": [
      {
        "name": "brand identity",
        "description": "Names, logos and visual systems people remember."
      },
      {
        "name": "campaigns",
        "description": "Launches and seasonal pushes, planned end to end."
      }
    ]
  },
  {
    "title": "be seen",
    "items": [
      {
        "name": "social media",
        "description": "A feed that looks like a brand, posted on schedule."
      },
      {
        "name": "content + reels",
        "description": "Reels and edits people watch to the end."
      },
      {
        "name": "instagram + facebook ads",
        "description": "Instagram and Facebook campaigns built to sell."
      }
    ]
  },
  {
    "title": "be found",
    "items": [
      {
        "name": "search + ai answers",
        "description": "Found on Google and maps, and named in AI answers."
      },
      {
        "name": "google ads",
        "description": "Show up when people search for what you sell."
      }
    ]
  },
  {
    "title": "be chosen",
    "items": [
      {
        "name": "websites",
        "description": "Sites and landing pages that turn visits into enquiries."
      },
      {
        "name": "whatsapp",
        "description": "Catalogs, quick replies and booking flows."
      },
      {
        "name": "email",
        "description": "Newsletters and sequences that bring people back."
      }
    ]
  }
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
export function chatLink(message: string) {
  return `https://wa.me/${whatsapp}?text=${encodeURIComponent(message)}`;
}

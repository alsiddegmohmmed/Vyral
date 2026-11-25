// Starting points for the new-card wizard (/cards/new). The mechanism (pick a
// kind of business, and the card fills in sensible defaults) comes from
// studying StampMate's public wizard; these types, rewards, names and colours
// are our own. Owners can change every one of them in the wizard or the designer.

export type Theme = { id: string; name: string; background: string; foreground: string; label: string; stamp: string };

/** Merchant colour themes. Each pair is AA (text on background) and is re-checked live in the designer. */
export const THEMES: Theme[] = [
  { id: 'espresso', name: 'Espresso', background: '#2B1E17', foreground: '#F3E6D3', label: '#D9B99B', stamp: '#F3E6D3' },
  { id: 'jacaranda', name: 'Jacaranda', background: '#6A3BE0', foreground: '#FFFFFF', label: '#EEE7FF', stamp: '#FFFFFF' },
  { id: 'night', name: 'Night', background: '#17122B', foreground: '#F7F4FF', label: '#B8AED6', stamp: '#FFB23F' },
  { id: 'clay', name: 'Clay', background: '#8A3A22', foreground: '#FFF4EC', label: '#F2C6B4', stamp: '#FFF4EC' },
  { id: 'forest', name: 'Forest', background: '#1E5B3A', foreground: '#F2FFF5', label: '#BFE8CB', stamp: '#F2FFF5' },
  { id: 'ocean', name: 'Ocean', background: '#0E4F68', foreground: '#EFFBFF', label: '#B5E3F0', stamp: '#EFFBFF' },
  { id: 'blush', name: 'Blush', background: '#F6DFE6', foreground: '#4E1A2D', label: '#86364F', stamp: '#4E1A2D' },
  { id: 'sand', name: 'Sand', background: '#F4E6CC', foreground: '#3F2812', label: '#7E5427', stamp: '#3F2812' },
  { id: 'graphite', name: 'Graphite', background: '#1C1C1E', foreground: '#F5F5F5', label: '#B9B9BE', stamp: '#F5F5F5' },
];

export type BusinessType = {
  id: string; label: string; icon: string; reward: string; stamps: number; cardName: string; theme: string;
};

/** Ordered for Kigali's high streets first. `icon` keys match stampIcons in components/loyalty/stamp-strip. */
export const BUSINESS_TYPES: BusinessType[] = [
  { id: 'cafe', label: 'Café', icon: 'cup', reward: 'Free coffee', stamps: 10, cardName: 'Coffee card', theme: 'espresso' },
  { id: 'restaurant', label: 'Restaurant', icon: 'utensils', reward: 'Free main dish', stamps: 8, cardName: 'Meal card', theme: 'clay' },
  { id: 'bakery', label: 'Bakery', icon: 'croissant', reward: 'Free pastry', stamps: 8, cardName: 'Pastry card', theme: 'sand' },
  { id: 'juice', label: 'Juice bar', icon: 'soda', reward: 'Free juice', stamps: 8, cardName: 'Juice card', theme: 'forest' },
  { id: 'salon', label: 'Salon & beauty', icon: 'flower', reward: 'Free treatment', stamps: 6, cardName: 'Beauty card', theme: 'blush' },
  { id: 'barber', label: 'Barber', icon: 'scissors', reward: 'Free cut', stamps: 6, cardName: 'Barber card', theme: 'graphite' },
  { id: 'gym', label: 'Gym & fitness', icon: 'dumbbell', reward: 'Free class', stamps: 10, cardName: 'Gym card', theme: 'ocean' },
  { id: 'carwash', label: 'Car wash', icon: 'star', reward: 'Free wash', stamps: 5, cardName: 'Car wash card', theme: 'ocean' },
  { id: 'pets', label: 'Pet care', icon: 'paw', reward: 'Free grooming', stamps: 6, cardName: 'Pet card', theme: 'forest' },
  { id: 'shop', label: 'Shop', icon: 'heart', reward: '10% off your next visit', stamps: 10, cardName: 'Loyalty card', theme: 'jacaranda' },
  { id: 'other', label: 'Something else', icon: 'star', reward: 'A free gift', stamps: 10, cardName: 'Loyalty card', theme: 'jacaranda' },
];

export const STAMP_CHOICES = [4, 5, 6, 7, 8, 9, 10, 12] as const;
export const themeById = (id: string) => THEMES.find((t) => t.id === id) ?? THEMES[1];

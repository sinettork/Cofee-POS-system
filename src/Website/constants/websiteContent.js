import { Banknote, CreditCard, QrCode } from 'lucide-react'

export const MARQUEE_ITEMS = [
  'Specialty Coffee',
  'Fresh Pastries Daily',
  'Artisan Breads',
  'Handcrafted Donuts',
  'Seasonal Cakes',
  'Dine In & Take Away',
]

export const NAV_LINKS = [
  { href: '#about', label: 'Our Story' },
  { href: '#menu', label: 'Menu' },
  { href: '#experience', label: 'Experience' },
  { href: '#location', label: 'Visit Us' },
]

export const EXPERIENCE_ITEMS = [
  {
    icon: '\u{1FAD8}',
    title: 'Single-Origin Beans',
    text: 'Every batch traced from farm to cup. We partner with sustainable growers across Ethiopia, Colombia, and Guatemala.',
  },
  {
    icon: '\u{1F950}',
    title: 'Baked Fresh Daily',
    text: 'Our kitchen begins before dawn. Croissants, sourdoughs, and cakes crafted each morning with seasonal ingredients.',
  },
  {
    icon: '\u{1FA91}',
    title: 'Warm Atmosphere',
    text: 'Whether dine-in or take away, we design every visit to feel like a breath of fresh air in your busy day.',
  },
  {
    icon: '\u{1F4F1}',
    title: 'Easy Ordering',
    text: 'Walk in, sit down, and let us handle the rest. Track your order in real-time and customize to your taste.',
  },
  {
    icon: '\u{1F381}',
    title: 'Loyalty Rewards',
    text: 'Every visit counts. Earn points on every purchase and unlock exclusive menu items and seasonal specials.',
  },
  {
    icon: '\u{1F33F}',
    title: 'Sustainably Minded',
    text: 'Compostable packaging, direct-trade sourcing, and a commitment to reducing our footprint without reducing taste.',
  },
]

export const TESTIMONIALS = [
  {
    quote:
      '"The Beef Crowich is unlike anything I have had. And the coffee, absolutely perfect every single time."',
    name: 'Sarah M.',
    role: 'Regular since opening day',
    avatar: '\u{1F469}',
  },
  {
    quote:
      '"Eloise Coffee is my second home. The atmosphere, the team, and that Cheezy Sourdough. Pure magic."',
    name: 'James T.',
    role: 'Coffee enthusiast',
    avatar: '\u{1F468}',
  },
  {
    quote:
      '"I come for the Americano and stay for the Cheesy Cheesecake. Honestly the best coffee shop in town."',
    name: 'Priya K.',
    role: 'Food blogger',
    avatar: '\u{1F469}',
  },
]

export const DAY_SCHEDULE = {
  Monday: '7:00 AM - 9:00 PM',
  Tuesday: '7:00 AM - 9:00 PM',
  Wednesday: '7:00 AM - 9:00 PM',
  Thursday: '7:00 AM - 9:00 PM',
  Friday: '7:00 AM - 10:00 PM',
  Saturday: '8:00 AM - 10:00 PM',
  Sunday: '8:00 AM - 8:00 PM',
}

export const PAYMENT_METHOD_ITEMS = [
  { id: 'Cash', label: 'Cash on Delivery', icon: Banknote },
  { id: 'KHQR', label: 'Pay via KHQR', icon: QrCode },
  { id: 'Card', label: 'Card', icon: CreditCard },
]

export const TRACKING_STEP_LABELS = ['Order Placed', 'Preparing', 'Out for Delivery', 'Delivered']

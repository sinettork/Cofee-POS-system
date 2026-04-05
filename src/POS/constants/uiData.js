import {
  Activity,
  Coffee,
  Croissant,
  CupSoda,
  Donut,
  FileText,
  Package,
  Sandwich,
  Settings,
  Truck,
  Users,
} from 'lucide-react'

export const PAGE_ITEMS = [
  { id: 'pos', name: 'Point of Sales', icon: Coffee },
  { id: 'activity', name: 'Activity', icon: Activity },
  { id: 'delivery', name: 'Delivery', icon: Truck },
  { id: 'report', name: 'Report', icon: FileText },
]

export const QUICK_MENU_ITEMS = [
  ...PAGE_ITEMS,
  { id: 'inventory', name: 'Inventory', icon: Package },
  { id: 'teams', name: 'Team', icon: Users },
  { id: 'settings', name: 'Settings', icon: Settings },
]

export const CATEGORY_ITEMS = [
  { id: 'all', name: 'All Menu', count: 15, icon: Coffee },
  { id: 'coffee', name: 'Coffee', count: 5, icon: Coffee },
  { id: 'bread', name: 'Breads', count: 3, icon: Croissant },
  { id: 'cake', name: 'Cakes', count: 2, icon: CupSoda },
  { id: 'donut', name: 'Donuts', count: 1, icon: Donut },
  { id: 'pastry', name: 'Pastries', count: 3, icon: Croissant },
  { id: 'sandwich', name: 'Sandwich', count: 1, icon: Sandwich },
]

export const PRODUCT_ITEMS = [
  {
    id: 'm01',
    name: 'Beef Crowich',
    category: 'sandwich',
    label: 'Sandwich',
    basePrice: 5.5,
    image:
      'https://images.unsplash.com/photo-1567234669003-dce7a7a88821?auto=format&fit=crop&q=80&w=480&h=320',
    description: 'Toasted bun, juicy beef patty, and fresh greens.',
    customizable: true,
    options: {
      size: [
        { name: 'Regular', price: 0 },
        { name: 'Large', price: 1 },
      ],
      extras: [
        { name: 'No Extras', price: 0 },
        { name: 'Cheese', price: 0.75 },
        { name: 'Bacon', price: 1.2 },
      ],
    },
  },
  {
    id: 'm02',
    name: 'Buttermelt Croissant',
    category: 'pastry',
    label: 'Pastry',
    basePrice: 4,
    image:
      'https://images.unsplash.com/photo-1555507036-ab794f57593b?auto=format&fit=crop&q=80&w=480&h=320',
    description: 'Premium butter croissant with crispy crust and soft inside.',
    customizable: true,
    options: {
      size: [{ name: 'Single', price: 0 }],
      extras: [
        { name: 'No Extras', price: 0 },
        { name: 'Chocolate Dip', price: 0.8 },
      ],
    },
  },
  {
    id: 'm03',
    name: 'Cereal Cream Donut',
    category: 'donut',
    label: 'Donut',
    basePrice: 2.45,
    image:
      'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&q=80&w=480&h=320',
    description: 'Fluffy donut finished with cereal cream glaze.',
    customizable: false,
  },
  {
    id: 'm04',
    name: 'Cheesy Cheesecake',
    category: 'cake',
    label: 'Cake',
    basePrice: 3.75,
    image:
      'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&q=80&w=480&h=320',
    description: 'Rich and creamy cheesecake slice with buttery crumb.',
    customizable: false,
  },
  {
    id: 'm05',
    name: 'Cheezy Sourdough',
    category: 'bread',
    label: 'Bread',
    basePrice: 4.5,
    image:
      'https://images.unsplash.com/photo-1608198093002-ad4e005484ec?auto=format&fit=crop&q=80&w=480&h=320',
    description: 'Fresh sourdough loaf with melted cheddar center.',
    customizable: false,
  },
  {
    id: 'm06',
    name: 'Egg Tart',
    category: 'pastry',
    label: 'Tart',
    basePrice: 3.25,
    image:
      'https://images.unsplash.com/photo-1624353365286-3f8d62daad51?auto=format&fit=crop&q=80&w=480&h=320',
    description: 'Silky baked custard in a flaky shell.',
    customizable: false,
  },
  {
    id: 'm07',
    name: 'Grains Pan Bread',
    category: 'bread',
    label: 'Bread',
    basePrice: 4.5,
    image:
      'https://images.unsplash.com/photo-1506084868230-bb9d95c24759?auto=format&fit=crop&q=80&w=480&h=320',
    description: 'Multi-grain baked bread, soft center and crispy top.',
    customizable: false,
  },
  {
    id: 'm08',
    name: 'Spinchoco Roll',
    category: 'pastry',
    label: 'Pastry',
    basePrice: 4,
    image:
      'https://images.unsplash.com/photo-1541782814456-0d7f8f4b31ea?auto=format&fit=crop&q=80&w=480&h=320',
    description: 'Rolled pastry filled with dark chocolate cream.',
    customizable: false,
  },
  {
    id: 'm09',
    name: 'Sliced Black Forest',
    category: 'cake',
    label: 'Cake',
    basePrice: 5,
    image:
      'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&q=80&w=480&h=320',
    description: 'Moist chocolate layers with whipped cream.',
    customizable: false,
  },
  {
    id: 'm10',
    name: 'Solo Floss Bread',
    category: 'bread',
    label: 'Bread',
    basePrice: 4.5,
    image:
      'https://images.unsplash.com/photo-1585478259715-876acc5be8eb?auto=format&fit=crop&q=80&w=480&h=320',
    description: 'Soft bun topped with savory floss.',
    customizable: false,
  },
  {
    id: 'm11',
    name: 'Espresso Shot',
    category: 'coffee',
    label: 'Coffee',
    basePrice: 2.5,
    image:
      'https://images.unsplash.com/photo-1510707577719-ae7c14805e3a?auto=format&fit=crop&q=80&w=480&h=320',
    description: 'Intense single-origin espresso with rich crema.',
    customizable: true,
    options: {
      size: [
        { name: 'Single', price: 0 },
        { name: 'Double', price: 1.25 },
      ],
      extras: [
        { name: 'No Extras', price: 0 },
        { name: 'Extra Shot', price: 1 },
      ],
    },
  },
  {
    id: 'm12',
    name: 'Americano',
    category: 'coffee',
    label: 'Coffee',
    basePrice: 3.25,
    image:
      'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&q=80&w=480&h=320',
    description: 'Smooth espresso diluted with hot water for a clean finish.',
    customizable: true,
    options: {
      size: [
        { name: 'Regular', price: 0 },
        { name: 'Large', price: 0.75 },
      ],
      extras: [
        { name: 'No Extras', price: 0 },
        { name: 'Extra Shot', price: 1 },
      ],
    },
  },
  {
    id: 'm13',
    name: 'Cappuccino',
    category: 'coffee',
    label: 'Coffee',
    basePrice: 3.95,
    image:
      'https://images.unsplash.com/photo-1572442388796-11668a67e53d?auto=format&fit=crop&q=80&w=480&h=320',
    description: 'Balanced espresso with steamed milk and thick foam.',
    customizable: true,
    options: {
      size: [
        { name: 'Regular', price: 0 },
        { name: 'Large', price: 0.85 },
      ],
      extras: [
        { name: 'No Extras', price: 0 },
        { name: 'Oat Milk', price: 0.6 },
        { name: 'Extra Shot', price: 1 },
      ],
    },
  },
  {
    id: 'm14',
    name: 'Latte',
    category: 'coffee',
    label: 'Coffee',
    basePrice: 4.2,
    image:
      'https://images.unsplash.com/photo-1521302200778-33500795e128?auto=format&fit=crop&q=80&w=480&h=320',
    description: 'Creamy espresso latte with silky steamed milk.',
    customizable: true,
    options: {
      size: [
        { name: 'Regular', price: 0 },
        { name: 'Large', price: 0.9 },
      ],
      extras: [
        { name: 'No Extras', price: 0 },
        { name: 'Vanilla Syrup', price: 0.5 },
        { name: 'Caramel Syrup', price: 0.5 },
      ],
    },
  },
  {
    id: 'm15',
    name: 'Iced Mocha',
    category: 'coffee',
    label: 'Coffee',
    basePrice: 4.75,
    image:
      'https://images.unsplash.com/photo-1578314675249-a6910f80cc9d?auto=format&fit=crop&q=80&w=480&h=320',
    description: 'Chilled mocha blend with espresso, cocoa, and milk.',
    customizable: true,
    options: {
      size: [
        { name: 'Regular', price: 0 },
        { name: 'Large', price: 0.95 },
      ],
      extras: [
        { name: 'No Extras', price: 0 },
        { name: 'Whipped Cream', price: 0.6 },
        { name: 'Extra Shot', price: 1 },
      ],
    },
  },
]

export const TRACKING_ORDERS = [
  {
    id: 't01',
    name: 'Mike',
    status: 'On Kitchen Hand',
    table: 'Table 04',
    type: 'Dine In',
    time: '10:00 AM',
  },
  {
    id: 't02',
    name: 'Billie',
    status: 'All Done',
    table: 'Table 03',
    type: 'Take Away',
    time: '08:45 AM',
  },
  {
    id: 't03',
    name: 'Richard',
    status: 'To Be Served',
    table: 'Table 02',
    type: 'Dine In',
    time: '08:15 AM',
  },
  {
    id: 't04',
    name: 'Sharon',
    status: 'On Kitchen Hand',
    table: 'Table 05',
    type: 'Dine In',
    time: '10:00 AM',
  },
]

export const BILLING_QUEUE = [
  {
    id: 'q01',
    customer: 'Francois',
    order: '#006',
    table: 'Table 06',
    amount: 20,
    status: 'active',
    time: '09:15 AM',
  },
  {
    id: 'q02',
    customer: 'Eloise',
    order: '#005',
    table: 'Table 05',
    amount: 19.35,
    status: 'closed',
    time: '09:00 AM',
  },
  {
    id: 'q03',
    customer: 'Mike',
    order: '#004',
    table: 'Table 04',
    amount: 25,
    status: 'active',
    time: '08:15 AM',
  },
  {
    id: 'q04',
    customer: 'Billie',
    order: '#003',
    table: 'Table 03',
    amount: 31.5,
    status: 'active',
    time: '08:00 AM',
  },
]

export const TABLE_GROUPS = [
  {
    title: '2 Persons Table',
    tables: [
      { id: 'T-01', guest: 'Sharon', pax: 2, time: '09:00 AM', status: 'served' },
      { id: 'T-02', guest: '0 Guest', pax: 0, time: '--:--', status: 'available' },
      { id: 'T-03', guest: 'Billie', pax: 2, time: '09:00 AM', status: 'served' },
      { id: 'T-04', guest: 'Mike', pax: 1, time: '09:00 AM', status: 'served' },
      { id: 'T-05', guest: '0 Guest', pax: 0, time: '--:--', status: 'available' },
      { id: 'T-06', guest: '0 Guest', pax: 0, time: '--:--', status: 'available' },
    ],
  },
  {
    title: '4 Persons',
    tables: [
      { id: 'T-07', guest: '0 Guest', pax: 0, time: '--:--', status: 'available' },
      { id: 'T-08', guest: 'Hyacinth', pax: 3, time: '01:00 PM', status: 'reserved' },
      { id: 'T-09', guest: '0 Guest', pax: 0, time: '--:--', status: 'available' },
      { id: 'T-10', guest: 'Justin', pax: 4, time: '09:30 AM', status: 'served' },
    ],
  },
  {
    title: 'Max 12 Persons',
    tables: [
      { id: 'T-11', guest: '0 Guest', pax: 0, time: '--:--', status: 'available' },
      { id: 'T-12', guest: 'Clark', pax: 5, time: '11:00 AM', status: 'served' },
      { id: 'T-13', guest: 'Meera', pax: 10, time: '12:00 PM', status: 'reserved' },
      { id: 'T-14', guest: '0 Guest', pax: 0, time: '--:--', status: 'available' },
      { id: 'T-15', guest: '0 Guest', pax: 0, time: '--:--', status: 'available' },
      { id: 'T-16', guest: 'Wendy', pax: 12, time: '12:30 PM', status: 'reserved' },
    ],
  },
]

export const HISTORY_ROWS = [
  {
    id: '001',
    at: '25/05/2024 - 08:00 AM',
    customer: 'George',
    status: 'Done',
    payment: 35,
    paid: true,
  },
  {
    id: '002',
    at: '25/05/2024 - 08:17 AM',
    customer: 'Charlie',
    status: 'Done',
    payment: 12.5,
    paid: true,
  },
  {
    id: '003',
    at: '25/05/2024 - 08:30 AM',
    customer: 'Hyacinth',
    status: 'Done',
    payment: 15.25,
    paid: true,
  },
  {
    id: '004',
    at: '25/05/2024 - 08:35 AM',
    customer: 'Francesca',
    status: 'Done',
    payment: 22.1,
    paid: true,
  },
  {
    id: '005',
    at: '25/05/2024 - 08:42 AM',
    customer: 'Eliza',
    status: 'Canceled',
    payment: 12.25,
    paid: false,
  },
  {
    id: '006',
    at: '25/05/2024 - 09:00 AM',
    customer: 'Jelly',
    status: 'Done',
    payment: 64,
    paid: true,
  },
  {
    id: '007',
    at: '25/05/2024 - 11:20 AM',
    customer: 'Justin',
    status: 'Done',
    payment: 21.5,
    paid: true,
  },
  {
    id: '008',
    at: '25/05/2024 - 11:58 AM',
    customer: 'Gregory',
    status: 'Done',
    payment: 16.25,
    paid: true,
  },
]

export const FAVORITES = [
  {
    id: 'f01',
    name: 'Buttermelt Croissant',
    category: 'Pastry',
    orderCount: 183,
    image: PRODUCT_ITEMS[1].image,
  },
  {
    id: 'f02',
    name: 'Beef Crowich',
    category: 'Sandwich',
    orderCount: 160,
    image: PRODUCT_ITEMS[0].image,
  },
  {
    id: 'f03',
    name: 'Sliced Blackforest',
    category: 'Cake',
    orderCount: 125,
    image: PRODUCT_ITEMS[8].image,
  },
  {
    id: 'f04',
    name: 'Solo Floss Bread',
    category: 'Bread',
    orderCount: 119,
    image: PRODUCT_ITEMS[9].image,
  },
]

export const REPORT_ORDER_ROWS = [
  {
    id: '001',
    date: '25/05/2024 - 08:00 AM',
    customer: 'George',
    state: 'Done',
    payment: 35,
    paymentState: 'Paid',
  },
  {
    id: '002',
    date: '25/05/2024 - 08:17 AM',
    customer: 'Charlie',
    state: 'Done',
    payment: 12.5,
    paymentState: 'Paid',
  },
  {
    id: '003',
    date: '25/05/2024 - 08:30 AM',
    customer: 'Hyacinth',
    state: 'Done',
    payment: 15.25,
    paymentState: 'Paid',
  },
  {
    id: '004',
    date: '25/05/2024 - 08:35 AM',
    customer: 'Francesca',
    state: 'Done',
    payment: 22.1,
    paymentState: 'Paid',
  },
  {
    id: '005',
    date: '25/05/2024 - 08:42 AM',
    customer: 'Eliza',
    state: 'Canceled',
    payment: 12.25,
    paymentState: 'Unpaid',
  },
]

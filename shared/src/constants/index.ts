export const PROPERTY_TYPES = [
  { value: 'one_bedroom', label: 'One Bedroom' },
  { value: 'airbnb', label: 'Airbnb / Vacation Home' },
  { value: 'single_room', label: 'Single Room' },
  { value: 'bedsitter', label: 'Bedsitter / Studio' },
  { value: 'bnb', label: 'Bed & Breakfast (BnB)' },
] as const;

export const BOOKING_STATUSES = [
  { value: 'pending', label: 'Pending Approval' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'checked_in', label: 'Checked In' },
  { value: 'checked_out', label: 'Checked Out' },
  { value: 'cancelled', label: 'Cancelled' },
] as const;

export const PAYMENT_METHODS = [
  { value: 'mpesa', label: 'M-Pesa Mobile Money (KES)', currency: 'KES', isInternational: false },
  { value: 'card', label: 'Credit / Debit Card (KES/USD)', currency: 'KES', isInternational: false },
  { value: 'paypal', label: 'PayPal (USD)', currency: 'USD', isInternational: true },
  { value: 'flutterwave', label: 'Flutterwave (KES/USD)', currency: 'KES', isInternational: true },
  { value: 'bank_transfer', label: 'Bank Transfer (KES)', currency: 'KES', isInternational: false },
  { value: 'cash', label: 'Cash (POS / Front-Desk - KES)', currency: 'KES', isInternational: false },
] as const;

export const USER_ROLES = [
  { value: 'customer', label: 'Customer' },
  { value: 'admin', label: 'Administrator' },
  { value: 'cashier', label: 'POS Cashier' },
] as const;

export const DEFAULT_AMENITIES = [
  'High-Speed Wi-Fi',
  'Air Conditioning',
  'Dedicated Workspace',
  'Free Parking on Premises',
  'Swimming Pool',
  'Kitchen / Kitchenette',
  'Smart TV / Netflix',
  'Hot Water / Shower',
  '24/7 Security / CCTV',
  'Balcony / Scenic View',
  'Washing Machine',
  'Power Backup / Generator',
] as const;

export const DEFAULT_TAX_RATE = 0.16; // 16% VAT default
export const DEFAULT_CURRENCY = 'KES'; // System primary currency is Kenyan Shilling
export const USD_TO_KES_RATE = 130; // 1 USD ≈ 130 KES

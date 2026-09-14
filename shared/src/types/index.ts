export type UserRole = 'customer' | 'admin' | 'cashier' | 'property_owner';
export type UserStatus = 'active' | 'inactive' | 'suspended';

export interface User {
  id: string;
  email: string;
  phone?: string | null;
  firstName: string;
  lastName: string;
  role: UserRole;
  status: UserStatus;
  profileImageUrl?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  twoFactorEnabled?: boolean;
  lastLogin?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type PropertyType = 'one_bedroom' | 'airbnb' | 'single_room' | 'bedsitter' | 'bnb';
export type PropertyStatus = 'available' | 'booked' | 'maintenance' | 'inactive';

export interface Amenity {
  id: string;
  name: string;
  icon?: string | null;
}

export interface PropertyImage {
  id: string;
  propertyId: string;
  imageUrl: string;
  isCover: boolean;
  displayOrder?: number;
}

export interface Property {
  id: string;
  ownerId: string;
  name: string;
  type: PropertyType;
  description: string;
  address: string;
  city: string;
  country: string;
  latitude?: number | null;
  longitude?: number | null;
  pricePerNight: number;
  pricePerWeek?: number | null;
  pricePerMonth?: number | null;
  capacity: number;
  bedrooms?: number | null;
  bathrooms?: number | null;
  status: PropertyStatus;
  images?: string[] | PropertyImage[];
  amenities?: Amenity[] | string[];
  avgRating?: number;
  reviewCount?: number;
  createdAt: string;
  updatedAt: string;
}

export type BookingStatus = 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled';
export type BookingSource = 'website' | 'pos' | 'admin';

export interface Booking {
  id: string;
  propertyId: string;
  propertyName?: string;
  propertyType?: PropertyType;
  propertyAddress?: string;
  customerId: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  checkInDate: string;
  checkOutDate: string;
  numberOfGuests: number;
  totalAmount: number;
  status: BookingStatus;
  source: BookingSource;
  specialRequests?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type PaymentMethod = 'card' | 'mpesa' | 'paypal' | 'bank_transfer' | 'cash' | 'flutterwave';
export type PaymentStatus = 'pending' | 'paid' | 'partially_paid' | 'refunded' | 'failed';

export interface Payment {
  id: string;
  bookingId: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  transactionRef?: string | null;
  issuedBy?: string | null;
  notes?: string | null;
  propertyName?: string;
  propertyAddress?: string;
  customerName?: string;
  customerEmail?: string;
  bookingTotal?: number;
  checkInDate?: string;
  checkOutDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Receipt {
  id: string;
  paymentId: string;
  receiptNumber: string;
  pdfUrl?: string | null;
  createdAt: string;
}

export type ShiftStatus = 'open' | 'closed';

export interface CashierShift {
  id: string;
  cashierId: string;
  cashierName?: string;
  openTime: string;
  closeTime?: string | null;
  openingBalance: number;
  expectedClosingBalance?: number | null;
  actualClosingBalance?: number | null;
  transactionCount: number;
  status: ShiftStatus;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Review {
  id: string;
  propertyId: string;
  customerId: string;
  customerName?: string;
  bookingId: string;
  rating: number;
  title?: string;
  comment: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

export interface Wishlist {
  id: string;
  customerId: string;
  propertyId: string;
  createdAt: string;
}

export interface SyncLog {
  id: string;
  entityType: string;
  entityId: string;
  action: 'insert' | 'update' | 'delete';
  status: 'pending' | 'synced' | 'error';
  deviceId?: string;
  errorMessage?: string | null;
  timestamp: string;
}

export interface SyncPacket {
  deviceId: string;
  lastSyncTimestamp: string;
  entities: {
    properties?: Property[];
    bookings?: Booking[];
    payments?: Payment[];
    shifts?: CashierShift[];
    syncLogs?: SyncLog[];
  };
}

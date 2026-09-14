import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const registerSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  phone: z.string().optional(),
});

export const propertyCreateSchema = z.object({
  name: z.string().min(3, 'Property name is required'),
  type: z.enum(['one_bedroom', 'airbnb', 'single_room', 'bedsitter', 'bnb']),
  description: z.string().optional(),
  address: z.string().min(3, 'Address is required'),
  city: z.string().min(2, 'City is required'),
  country: z.string().min(2, 'Country is required'),
  pricePerNight: z.number().positive('Price per night must be positive'),
  capacity: z.number().int().positive().default(1),
  bedrooms: z.number().int().optional(),
  bathrooms: z.number().int().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

export const bookingCreateSchema = z.object({
  propertyId: z.string().uuid(),
  checkInDate: z.string().date('Date must be in YYYY-MM-DD format'),
  checkOutDate: z.string().date('Date must be in YYYY-MM-DD format'),
  numberOfGuests: z.number().int().min(1).default(1),
  specialRequests: z.string().optional(),
});

export const paymentCreateSchema = z.object({
  bookingId: z.string().uuid(),
  amount: z.number().positive(),
  method: z.enum(['card', 'mpesa', 'paypal', 'bank_transfer', 'cash', 'flutterwave']),
  phoneNumber: z.string().optional(),
  transactionRef: z.string().optional(),
});

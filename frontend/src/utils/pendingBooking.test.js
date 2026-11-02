import { describe, it, expect, beforeEach, vi } from 'vitest';
import { savePendingBooking, getPendingBooking, consumePendingBooking } from './pendingBooking';

describe('pending booking resume flow', () => {
  beforeEach(() => {
    const storage = new Map();
    vi.stubGlobal('sessionStorage', {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: (key) => storage.delete(key),
      clear: () => storage.clear(),
    });
  });

  it('persists and resumes the draft booking after a login redirect', () => {
    const draft = {
      propertyId: 'prop-123',
      checkInDate: '2026-01-10',
      checkOutDate: '2026-01-12',
      numberOfGuests: 2,
      totalAmount: 20000,
      nights: 2,
    };

    savePendingBooking(draft);

    expect(getPendingBooking()).toEqual(draft);
    expect(consumePendingBooking()).toEqual(draft);
    expect(getPendingBooking()).toBeNull();
  });
});

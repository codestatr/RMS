import { describe, it, expect, beforeEach } from 'vitest';
import { savePendingBooking, getPendingBooking, consumePendingBooking } from './pendingBooking';

describe('pending booking resume flow', () => {
  beforeEach(() => {
    sessionStorage.clear();
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

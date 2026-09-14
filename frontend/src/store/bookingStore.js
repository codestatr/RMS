import { create } from 'zustand';

const initialDraft = {
  property: null,
  checkInDate: '',
  checkOutDate: '',
  numberOfGuests: 1,
  specialRequests: '',
  promoCode: '',
  discountPercent: 0,
  isSplitPayment: false,
};

export const useBookingStore = create((set, get) => ({
  draft: { ...initialDraft },
  draftBooking: { ...initialDraft },

  setDraft: (newDraft) =>
    set((state) => {
      const nextDraft = { ...state.draft, ...newDraft };
      return {
        draft: nextDraft,
        draftBooking: nextDraft,
      };
    }),

  setDraftBooking: (newDraft) =>
    set((state) => {
      const nextDraft = { ...state.draft, ...newDraft };
      return {
        draft: nextDraft,
        draftBooking: nextDraft,
      };
    }),

  clearDraft: () =>
    set({
      draft: { ...initialDraft },
      draftBooking: { ...initialDraft },
    }),

  getDraftBooking: () => get().draftBooking,
}));

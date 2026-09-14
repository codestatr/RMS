import { create } from 'zustand';
import { wishlistService } from '../services/wishlistService';

export const useWishlistStore = create((set, get) => ({
  savedProperties: [],
  savedIds: new Set(),
  isLoading: false,

  fetchWishlist: async () => {
    set({ isLoading: true });
    try {
      const res = await wishlistService.getMyWishlist();
      const list = res.data || [];
      set({
        savedProperties: list,
        savedIds: new Set(list.map((p) => p.id)),
        isLoading: false,
      });
    } catch (e) {
      set({ isLoading: false });
    }
  },

  toggleWishlist: async (property) => {
    const currentIds = new Set(get().savedIds);
    const isSaved = currentIds.has(property.id);

    if (isSaved) {
      currentIds.delete(property.id);
      set({
        savedIds: currentIds,
        savedProperties: get().savedProperties.filter((p) => p.id !== property.id),
      });
    } else {
      currentIds.add(property.id);
      set({
        savedIds: currentIds,
        savedProperties: [property, ...get().savedProperties],
      });
    }

    try {
      await wishlistService.toggle(property.id);
    } catch (err) {
      // Revert if error
      get().fetchWishlist();
    }
  },

  isSaved: (propertyId) => {
    return get().savedIds.has(propertyId);
  },
}));

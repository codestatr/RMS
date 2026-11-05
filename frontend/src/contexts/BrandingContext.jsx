import React, { createContext, useContext, useEffect, useState } from 'react';
import api from '../services/api';
import { applyBrandColor } from '../utils/brandTheme';

const DEFAULT_BRANDING = {
  brandName: 'CozyStay',
  brandColor: '#176b52',
  logo: '',
  phone: '+254 700 000000',
  email: 'support@rms-rentals.com',
};

const BrandingContext = createContext(DEFAULT_BRANDING);

export function BrandingProvider({ children }) {
  const [branding, setBranding] = useState(DEFAULT_BRANDING);

  useEffect(() => {
    let active = true;
    const refreshBranding = () => {
      api.get('/settings/branding')
        .then(({ data }) => {
          const shared = { ...DEFAULT_BRANDING, ...(data?.data || {}) };
          if (!active) return;
          setBranding(shared);
          applyBrandColor(shared.brandColor);
          document.title = `${shared.brandName} - Find your place to stay`;
        })
        .catch(() => applyBrandColor(DEFAULT_BRANDING.brandColor));
    };

    refreshBranding();
    const interval = window.setInterval(refreshBranding, 60000);
    window.addEventListener('focus', refreshBranding);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshBranding);
    };
  }, []);

  return <BrandingContext.Provider value={branding}>{children}</BrandingContext.Provider>;
}

export function useBranding() {
  return useContext(BrandingContext);
}

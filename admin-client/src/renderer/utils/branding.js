const DEFAULT_BRANDING = {
  name: 'CozyStay',
  logo: '',
  brandColor: '#176b52',
};

export function getBranding() {
  try {
    const stored = JSON.parse(localStorage.getItem('rms_branding') || '{}');
    if (typeof stored.name === 'string' && /\brms\b/i.test(stored.name)) {
      stored.name = DEFAULT_BRANDING.name;
      localStorage.setItem('rms_branding', JSON.stringify(stored));
    }
    return { ...DEFAULT_BRANDING, ...stored };
  } catch {
    return DEFAULT_BRANDING;
  }
}

export function saveBranding(branding) {
  const nextBranding = { ...DEFAULT_BRANDING, ...branding };
  localStorage.setItem('rms_branding', JSON.stringify(nextBranding));
  window.dispatchEvent(new CustomEvent('rms:branding-changed', { detail: nextBranding }));
  return nextBranding;
}

export { DEFAULT_BRANDING };

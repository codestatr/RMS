const DEFAULT_BRANDING = {
  name: 'RMS House Rental & Management',
  logo: '',
};

export function getBranding() {
  try {
    return { ...DEFAULT_BRANDING, ...JSON.parse(localStorage.getItem('rms_branding') || '{}') };
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

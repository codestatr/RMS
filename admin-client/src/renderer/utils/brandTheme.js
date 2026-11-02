export const DEFAULT_BRAND_COLOR = '#176b52';

const shades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];

export function applyBrandColor(color = DEFAULT_BRAND_COLOR) {
  const normalized = /^#[0-9a-f]{6}$/i.test(color) ? color : DEFAULT_BRAND_COLOR;
  const rgb = [1, 3, 5].map((offset) => parseInt(normalized.slice(offset, offset + 2), 16));
  const root = document.documentElement;
  const linear = rgb.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  const contrast = (foreground) => {
    const value = foreground === '#fff' ? 1 : 0;
    return (Math.max(luminance, value) + 0.05) / (Math.min(luminance, value) + 0.05);
  };

  root.style.setProperty('--brand-color', normalized);
  root.style.setProperty('--cozystay-accent', normalized);
  root.style.setProperty('--brand-contrast', contrast('#fff') >= contrast('#111') ? '#fff' : '#111');
  root.style.setProperty('--sidebar-blue-950', `var(--brand-900)`);
  root.style.setProperty('--sidebar-blue-900', `var(--brand-800)`);
  root.style.setProperty('--sidebar-blue-800', `var(--brand-700)`);
  root.style.setProperty('--sidebar-blue-700', `var(--brand-600)`);
  root.style.setProperty('--sidebar-blue-muted', `var(--brand-contrast)`);
  shades.forEach((shade) => {
    const target = shade < 500 ? 255 : 0;
    const amount = Math.abs((500 - shade) / 500);
    const channels = rgb.map((channel) => Math.round(channel + (target - channel) * amount));
    const value = `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
    root.style.setProperty(`--brand-${shade}`, value);
    root.style.setProperty(`--primary-${shade}`, value);
  });
}

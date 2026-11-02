export const DEFAULT_BRAND_COLOR = '#176b52';

const shades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];

export function applyBrandColor(color = DEFAULT_BRAND_COLOR) {
  const normalized = /^#[0-9a-f]{6}$/i.test(color) ? color : DEFAULT_BRAND_COLOR;
  const rgb = [1, 3, 5].map((offset) => parseInt(normalized.slice(offset, offset + 2), 16));
  const root = document.documentElement;

  root.style.setProperty('--brand-color', normalized);
  root.style.setProperty('--cozystay-accent', normalized);
  shades.forEach((shade) => {
    const amount = (500 - shade) / 500;
    const target = shade < 500 ? 255 : 0;
    const channels = rgb.map((channel) => Math.round(channel + (target - channel) * Math.abs(amount)));
    const value = `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
    root.style.setProperty(`--brand-${shade}`, value);
    root.style.setProperty(`--primary-${shade}`, value);
  });
}

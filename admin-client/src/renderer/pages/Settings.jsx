import React, { useEffect, useState } from 'react';
import { getBranding, saveBranding } from '../utils/branding';
import { applyBrandColor, DEFAULT_BRAND_COLOR } from '../utils/brandTheme';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export default function Settings() {
  const initialBranding = getBranding();
  const [businessName, setBusinessName] = useState(initialBranding.name);
  const [logo, setLogo] = useState(initialBranding.logo);
  const [brandColor, setBrandColor] = useState(DEFAULT_BRAND_COLOR);
  const [campaigns, setCampaigns] = useState([]);
  const [campaignsLoading, setCampaignsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    fetch(`${API_URL}/settings/branding`)
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Unable to load the shared brand color')))
      .then((response) => {
        const color = response?.data?.brandColor || DEFAULT_BRAND_COLOR;
        const sharedName = response?.data?.brandName;
        const sharedLogo = response?.data?.logo;
        if (sharedName) setBusinessName(sharedName);
        if (typeof sharedLogo === 'string') setLogo(sharedLogo);
        const current = getBranding();
        saveBranding({ name: sharedName || current.name, logo: typeof sharedLogo === 'string' ? sharedLogo : current.logo, brandColor: color });
        setBrandColor(color);
        applyBrandColor(color);
      })
      .catch(() => applyBrandColor());
  }, []);

  useEffect(() => {
    fetch(`${API_URL}/settings/homepage-campaigns`)
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Unable to load homepage campaigns')))
      .then((response) => setCampaigns(Array.isArray(response?.data) ? response.data : []))
      .catch((error) => setSaveError(error.message || 'Unable to load homepage campaigns.'))
      .finally(() => setCampaignsLoading(false));
  }, []);

  const updateCampaign = (id, updates) => {
    setCampaigns((items) => items.map((item) => item.id === id ? { ...item, ...updates } : item));
    setSavedMessage('');
  };

  const addCampaign = () => {
    if (campaigns.length >= 5) return;
    const id = window.crypto?.randomUUID?.() || `campaign-${Date.now()}`;
    setCampaigns((items) => [...items, { id, image: '', eyebrow: '', title: '', description: '', ctaLabel: '', ctaUrl: '/browse', active: true }]);
  };

  const handleCampaignImageChange = (id, event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 1024 * 1024) {
      setSaveError('Campaign images must be PNG, JPEG, or WebP files no larger than 1 MB.');
      event.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => updateCampaign(id, { image: String(reader.result) });
    reader.onerror = () => setSaveError('Could not read that campaign image.');
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const handleSaveSettings = async (event) => {
    event.preventDefault();
    setSaving(true);
    setSavedMessage('');
    setSaveError('');
    try {
      if (campaigns.some((campaign) => !campaign.image || !campaign.title?.trim())) {
        throw new Error('Every homepage banner needs an image and a headline, or remove that draft banner.');
      }
      const token = sessionStorage.getItem('rms_admin_token') || localStorage.getItem('rms_admin_token') || '';
      const response = await fetch(`${API_URL}/settings/branding`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ brandColor, brandName: businessName.trim(), logo }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || 'Could not save the shared color');
      const campaignResponse = await fetch(`${API_URL}/settings/homepage-campaigns`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ campaigns }),
      });
      const campaignResult = await campaignResponse.json();
      if (!campaignResponse.ok) throw new Error(campaignResult?.error || 'Could not save homepage banners');
      const savedColor = result?.data?.brandColor || brandColor;
      const savedName = result?.data?.brandName || businessName.trim();
      const savedLogo = typeof result?.data?.logo === 'string' ? result.data.logo : logo;
      setBusinessName(savedName);
      setLogo(savedLogo);
      setBrandColor(savedColor);
      setCampaigns(Array.isArray(campaignResult?.data) ? campaignResult.data : campaigns);
      saveBranding({ name: savedName, logo: savedLogo, brandColor: savedColor });
      applyBrandColor(savedColor);
      setSavedMessage('Changes saved.');
    } catch (error) {
      setSaveError(error.message || 'Could not save settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogoChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      setSaveError('Choose a PNG or JPEG logo so it can be embedded in PDF receipts.');
      event.target.value = '';
      return;
    }
    if (file.size > 1024 * 1024) {
      setSaveError('Logo files must be 1 MB or smaller.');
      event.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setLogo(String(reader.result));
      setSavedMessage('');
      setSaveError('');
    };
    reader.onerror = () => setSaveError('Could not read that logo file.');
    reader.readAsDataURL(file);
  };

  return (
    <div className="settings-workbench">
      <header className="settings-workbench-header">
        <div>
          <p className="settings-overline">WORKSPACE SETTINGS</p>
          <h2>Identity &amp; appearance</h2>
          <p>Set the business identity used by the portal and generated documents.</p>
        </div>
        <span className="settings-scope">ADMIN · WEB · POS</span>
      </header>

      <form className="settings-workbench-form" onSubmit={handleSaveSettings}>
        <nav className="settings-index" aria-label="Settings sections">
          <span>CONFIGURATION</span>
          <a href="#business-identity">01&nbsp; Business identity</a>
          <a href="#system-appearance">02&nbsp; Appearance</a>
          <a href="#homepage-promotions">03&nbsp; Website banners</a>
          <small>Business name and logo apply to the portal sidebar, sign-in screen, receipts, and reports. Accent color applies across the system.</small>
        </nav>

        <div className="settings-workbench-content">
          <section className="settings-workbench-section" id="business-identity">
            <div className="settings-section-heading">
              <span>01</span><div><h3>Business identity</h3><p>Name on POS receipts and logo on PDF receipts and reports.</p></div>
            </div>
            <div className="settings-identity-grid">
              <label className="settings-field">
                <span>Business name</span>
                <input value={businessName} onChange={(event) => setBusinessName(event.target.value)} maxLength={80} required />
              </label>
              <div className="settings-field settings-logo-field">
                <span>Portal and document logo</span>
                <div className="settings-logo-row">
                  {logo ? <img src={logo} alt="Current business logo" className="settings-workbench-logo" /> : <div className="settings-workbench-logo settings-no-logo">No logo</div>}
                  <label className="settings-upload-button">Choose image<input type="file" accept="image/png,image/jpeg" onChange={handleLogoChange} /></label>
                  <small>PNG or JPEG · up to 1 MB</small>
                </div>
              </div>
            </div>
          </section>

          <section className="settings-workbench-section" id="system-appearance">
            <div className="settings-section-heading">
              <span>02</span><div><h3>System appearance</h3><p>One accent color shared by the admin client, customer website, and POS.</p></div>
            </div>
            <div className="settings-color-row">
              <label htmlFor="system-brand-color">Accent color</label>
              <div className="settings-color-control">
                <input id="system-brand-color" type="color" value={brandColor} onChange={(event) => { setBrandColor(event.target.value); applyBrandColor(event.target.value); setSavedMessage(''); }} />
                <code>{brandColor.toUpperCase()}</code>
              </div>
            </div>
            <p className="settings-current-scope"><span style={{ backgroundColor: brandColor }} /> Preview updates immediately. Save to publish the color to the other clients.</p>
          </section>

          <section className="settings-workbench-section" id="homepage-promotions">
            <div className="settings-section-heading">
              <span>03</span><div><h3>Website adverts &amp; offers</h3><p>Write the messages shown over the sliding homepage photos. Add multiple active banners for rotation, up to five total.</p></div>
            </div>
            <div className="homepage-campaign-toolbar">
              <p>{campaignsLoading ? 'Loading saved banners…' : `${campaigns.length} of 5 banners configured`}</p>
              <button type="button" onClick={addCampaign} disabled={campaignsLoading || campaigns.length >= 5}>Add banner</button>
            </div>
            {campaigns.length === 0 && !campaignsLoading && <p className="homepage-campaign-empty">No homepage adverts or offers are published. Add a banner to display your own message.</p>}
            <div className="homepage-campaign-list">
              {campaigns.map((campaign, index) => (
                <article className="homepage-campaign-editor" key={campaign.id}>
                  <header>
                    <strong>Banner {String(index + 1).padStart(2, '0')}</strong>
                    <label><input type="checkbox" checked={campaign.active !== false} onChange={(event) => updateCampaign(campaign.id, { active: event.target.checked })} /> Show on website</label>
                    <button type="button" onClick={() => setCampaigns((items) => items.filter((item) => item.id !== campaign.id))}>Remove</button>
                  </header>
                  <div className="homepage-campaign-grid">
                    <div className="homepage-campaign-image">
                      {campaign.image ? <img src={campaign.image} alt={`Banner ${index + 1} preview`} /> : <span>Choose a banner image</span>}
                      <label className="settings-upload-button">Choose image<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => handleCampaignImageChange(campaign.id, event)} /></label>
                      <small>PNG, JPEG, or WebP · up to 1 MB</small>
                    </div>
                    <div className="homepage-campaign-fields">
                      <label className="settings-field"><span>Small label</span><input value={campaign.eyebrow || ''} maxLength={50} placeholder="Optional: Seasonal offer" onChange={(event) => updateCampaign(campaign.id, { eyebrow: event.target.value })} /></label>
                      <label className="settings-field"><span>Headline</span><input value={campaign.title || ''} maxLength={120} placeholder="Headline shown over the photo" onChange={(event) => updateCampaign(campaign.id, { title: event.target.value })} /></label>
                      <label className="settings-field"><span>Offer details</span><textarea value={campaign.description || ''} maxLength={280} placeholder="Add the offer or details for guests" onChange={(event) => updateCampaign(campaign.id, { description: event.target.value })} /></label>
                      <div className="homepage-campaign-link-fields">
                        <label className="settings-field"><span>Button text</span><input value={campaign.ctaLabel || ''} maxLength={30} placeholder="Optional" onChange={(event) => updateCampaign(campaign.id, { ctaLabel: event.target.value })} /></label>
                        <label className="settings-field"><span>Website path</span><input value={campaign.ctaUrl || ''} maxLength={300} placeholder="/browse" onChange={(event) => updateCampaign(campaign.id, { ctaUrl: event.target.value })} /></label>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <footer className="settings-workbench-actions">
            <div aria-live="polite">{saveError && <span className="settings-feedback-error">{saveError}</span>}{savedMessage && <span className="settings-feedback-success">{savedMessage}</span>}</div>
            <button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
          </footer>
        </div>
      </form>
    </div>
  );
}

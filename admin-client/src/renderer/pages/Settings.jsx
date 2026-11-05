import React, { useEffect, useState } from 'react';
import { getBranding, saveBranding } from '../utils/branding';
import { applyBrandColor, DEFAULT_BRAND_COLOR } from '../utils/brandTheme';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

function compressSettingsImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error(`Could not process ${file.name}.`));
      image.onload = () => {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) {
          reject(new Error('Image compression is unavailable in this browser.'));
          return;
        }
        let scale = Math.min(1, 1920 / Math.max(image.width, image.height));
        let optimized = '';
        while (scale >= 0.35) {
          canvas.width = Math.max(1, Math.round(image.width * scale));
          canvas.height = Math.max(1, Math.round(image.height * scale));
          context.fillStyle = '#ffffff';
          context.fillRect(0, 0, canvas.width, canvas.height);
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          for (let quality = 0.86; quality >= 0.5; quality -= 0.08) {
            optimized = canvas.toDataURL('image/jpeg', quality);
            if (optimized.length <= 1_250_000) break;
          }
          if (optimized.length <= 1_250_000) break;
          scale *= 0.8;
        }
        if (optimized.length > 1_250_000) {
          reject(new Error(`${file.name} could not be reduced to the allowed upload size.`));
          return;
        }
        resolve(optimized);
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export default function Settings() {
  const initialBranding = getBranding();
  const [businessName, setBusinessName] = useState(initialBranding.name);
  const [businessPhone, setBusinessPhone] = useState(initialBranding.phone);
  const [businessEmail, setBusinessEmail] = useState(initialBranding.email);
  const [logo, setLogo] = useState(initialBranding.logo);
  const [brandColor, setBrandColor] = useState(initialBranding.brandColor || DEFAULT_BRAND_COLOR);
  const [campaigns, setCampaigns] = useState([]);
  const [campaignsLoading, setCampaignsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [processingImages, setProcessingImages] = useState(0);
  const [savedMessage, setSavedMessage] = useState('');
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    fetch(`${API_URL}/settings/branding`)
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Unable to load the shared brand color')))
      .then((response) => {
        const color = response?.data?.brandColor || DEFAULT_BRAND_COLOR;
        const sharedName = response?.data?.brandName;
        const sharedLogo = response?.data?.logo;
        const sharedPhone = response?.data?.phone;
        const sharedEmail = response?.data?.email;
        if (sharedName) setBusinessName(sharedName);
        if (typeof sharedLogo === 'string') setLogo(sharedLogo);
        if (typeof sharedPhone === 'string') setBusinessPhone(sharedPhone);
        if (typeof sharedEmail === 'string') setBusinessEmail(sharedEmail);
        const current = getBranding();
        saveBranding({ name: sharedName || current.name, logo: typeof sharedLogo === 'string' ? sharedLogo : current.logo, phone: sharedPhone ?? current.phone, email: sharedEmail ?? current.email, brandColor: color });
        setBrandColor(color);
        applyBrandColor(color);
      })
      .catch(() => applyBrandColor(getBranding().brandColor || DEFAULT_BRAND_COLOR));
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
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setSaveError('Choose a PNG, JPEG, or WebP campaign image.');
      event.target.value = '';
      return;
    }
    setSaveError('');
    setProcessingImages((count) => count + 1);
    compressSettingsImage(file)
      .then((image) => updateCampaign(id, { image }))
      .catch((error) => setSaveError(error.message || 'Could not process that campaign image.'))
      .finally(() => setProcessingImages((count) => Math.max(0, count - 1)));
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
        body: JSON.stringify({ brandColor, brandName: businessName.trim(), logo, phone: businessPhone.trim(), email: businessEmail.trim() }),
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
      const savedPhone = typeof result?.data?.phone === 'string' ? result.data.phone : businessPhone.trim();
      const savedEmail = typeof result?.data?.email === 'string' ? result.data.email : businessEmail.trim();
      setBusinessName(savedName);
      setLogo(savedLogo);
      setBusinessPhone(savedPhone);
      setBusinessEmail(savedEmail);
      setBrandColor(savedColor);
      setCampaigns(Array.isArray(campaignResult?.data) ? campaignResult.data : campaigns);
      saveBranding({ name: savedName, logo: savedLogo, phone: savedPhone, email: savedEmail, brandColor: savedColor });
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
    setSaveError('');
    setProcessingImages((count) => count + 1);
    compressSettingsImage(file).then((image) => {
      setLogo(image);
      setSavedMessage('');
      setSaveError('');
    }).catch((error) => setSaveError(error.message || 'Could not process that logo file.'))
      .finally(() => setProcessingImages((count) => Math.max(0, count - 1)));
    event.target.value = '';
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
          <a href="#business-contact">02&nbsp; Contact details</a>
          <a href="#system-appearance">03&nbsp; Appearance</a>
          <a href="#homepage-promotions">04&nbsp; Website banners</a>
          <a href="#guest-messaging">05&nbsp; Guest messages</a>
          <small>Business name, contact details, and logo are shared by the website, POS, receipts, and reports. CozyStay is the default name and can be changed here.</small>
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
                  <small>PNG or JPEG · automatically resized for upload</small>
                </div>
              </div>
            </div>
          </section>

          <section className="settings-workbench-section" id="business-contact">
            <div className="settings-section-heading">
              <span>02</span><div><h3>Business contact</h3><p>Contact details displayed on the customer website and business receipts.</p></div>
            </div>
            <div className="settings-identity-grid">
              <label className="settings-field">
                <span>Business phone</span>
                <input type="tel" value={businessPhone} onChange={(event) => setBusinessPhone(event.target.value)} maxLength={30} placeholder="+254 700 000000" />
              </label>
              <label className="settings-field">
                <span>Support email</span>
                <input type="email" value={businessEmail} onChange={(event) => setBusinessEmail(event.target.value)} maxLength={254} placeholder="support@rms-rentals.com" />
              </label>
            </div>
          </section>

          <section className="settings-workbench-section" id="system-appearance">
            <div className="settings-section-heading">
              <span>03</span><div><h3>System appearance</h3><p>One accent color shared by the admin client, customer website, and POS.</p></div>
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
              <span>04</span><div><h3>Website adverts &amp; offers</h3><p>Write the messages shown over the sliding homepage photos. Add multiple active banners for rotation, up to five total.</p></div>
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
                      <small>PNG, JPEG, or WebP · automatically resized for upload</small>
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

          <GuestMessagingSettings />

          <footer className="settings-workbench-actions">
            <div aria-live="polite">{saveError && <span className="settings-feedback-error">{saveError}</span>}{savedMessage && <span className="settings-feedback-success">{savedMessage}</span>}</div>
            <button type="submit" disabled={saving || processingImages > 0}>{processingImages > 0 ? 'Preparing images…' : saving ? 'Saving…' : 'Save changes'}</button>
          </footer>
        </div>
      </form>
    </div>
  );
}

const guestMessageLabels = {
  bookingConfirmation: 'Booking confirmation',
  arrivalReminder: 'Arrival reminder (1 day before check-in)',
  paymentReminder: 'Payment reminder (2 days before check-in)',
  checkoutReminder: 'Checkout reminder (checkout day)',
};

function GuestMessagingSettings() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deliveryConfigured, setDeliveryConfigured] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const token = sessionStorage.getItem('rms_admin_token') || localStorage.getItem('rms_admin_token') || '';

  useEffect(() => {
    fetch(`${API_URL}/settings/guest-messaging`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result?.error || 'Unable to load guest message templates.');
      setSettings(result.data?.settings || null);
        setDeliveryConfigured(Boolean(result.data?.deliveryConfigured));
      })
      .catch((requestError) => setError(requestError.message || 'Unable to load guest message templates.'))
      .finally(() => setLoading(false));
  }, []);

  const updateTemplate = (key, field, value) => setSettings((current) => ({
    ...current,
    [key]: { ...current[key], [field]: value },
  }));

  const save = async () => {
    setSaving(true); setError(''); setMessage('');
    try {
      const response = await fetch(`${API_URL}/settings/guest-messaging`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(settings),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || 'Unable to save guest message templates.');
      setSettings(result.data?.settings || null);
      setMessage('Guest message settings saved.');
    } catch (requestError) {
      setError(requestError.message || 'Unable to save guest message templates.');
    } finally { setSaving(false); }
  };

  return <section className="settings-workbench-section" id="guest-messaging">
    <div className="settings-section-heading"><span>05</span><div><h3>Guest messages &amp; reminders</h3><p>Edit email messages sent for confirmed bookings, upcoming arrivals, unpaid balances, and checkout.</p></div></div>
    {loading && <p className="settings-current-scope">Loading message settings…</p>}
    {!loading && error && !settings && <p className="settings-feedback-error" role="alert">{error}</p>}
    {settings && <>
      <label className="guest-messaging-toggle"><input type="checkbox" checked={settings.enabled !== false} onChange={(event) => setSettings((current) => ({ ...current, enabled: event.target.checked }))} /><span>Enable automated guest emails</span></label>
      <p className={deliveryConfigured ? 'settings-feedback-success' : 'settings-feedback-error'}>{deliveryConfigured ? 'Email delivery is configured on the backend.' : 'Email delivery is not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS on the backend to send messages.'}</p>
      <p className="guest-messaging-tokens">Available placeholders: {'{{guestName}}'}, {'{{businessName}}'}, {'{{propertyName}}'}, {'{{checkInDate}}'}, {'{{checkOutDate}}'}, {'{{totalAmount}}'}, {'{{balance}}'}, {'{{supportPhone}}'}, {'{{supportEmail}}'}.</p>
      <div className="guest-messaging-template-list">
        {Object.entries(guestMessageLabels).map(([key, label]) => <article className="guest-messaging-template" key={key}>
          <div className="guest-messaging-template-heading"><h4>{label}</h4><label><input type="checkbox" checked={settings[key]?.enabled !== false} onChange={(event) => updateTemplate(key, 'enabled', event.target.checked)} /> Enabled</label></div>
          <label className="settings-field"><span>Email subject</span><input maxLength={160} value={settings[key]?.subject || ''} onChange={(event) => updateTemplate(key, 'subject', event.target.value)} /></label>
          <label className="settings-field"><span>Message</span><textarea rows={5} maxLength={4000} value={settings[key]?.body || ''} onChange={(event) => updateTemplate(key, 'body', event.target.value)} /></label>
        </article>)}
      </div>
      <div className="guest-messaging-save"><div aria-live="polite">{error && <span className="settings-feedback-error">{error}</span>}{message && <span className="settings-feedback-success">{message}</span>}</div><button type="button" disabled={saving || loading} onClick={save}>{saving ? 'Saving…' : 'Save guest messages'}</button></div>
    </>}
  </section>;
}

import React, { useState } from 'react';
import {
  FaSlidersH,
  FaBuilding,
  FaPercentage,
  FaFileInvoiceDollar,
  FaDownload,
  FaSave,
  FaTag,
  FaMoneyBillWave,
} from 'react-icons/fa';
import { getBranding, saveBranding } from '../utils/branding';

export default function Settings() {
  const initialBranding = getBranding();
  const [businessName, setBusinessName] = useState(initialBranding.name);
  const [logo, setLogo] = useState(initialBranding.logo);
  const [supportEmail, setSupportEmail] = useState('support@rms-rentals.com');
  const [supportPhone, setSupportPhone] = useState('+254 700 000000');
  const [taxPin, setTaxPin] = useState('P051234567Z');
  const [defaultCurrency, setDefaultCurrency] = useState('KES');
  const [usdRate, setUsdRate] = useState(130);
  const [taxRate, setTaxRate] = useState(16);
  const [serviceFee, setServiceFee] = useState(5);
  const [weekendSurge, setWeekendSurge] = useState(10);
  const [savedMessage, setSavedMessage] = useState(false);

  const handleSaveSettings = (e) => {
    e.preventDefault();
    saveBranding({ name: businessName, logo });
    setSavedMessage(true);
    setTimeout(() => setSavedMessage(false), 3000);
  };

  const handleLogoChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setLogo(String(reader.result));
    reader.readAsDataURL(file);
  };

  const handleExportData = () => {
    const sampleExport = {
      exportTimestamp: new Date().toISOString(),
      system: 'RMS Rental Management System',
      version: '1.0.0',
      currency: 'KES',
      exchangeRateUSD: usdRate,
      database: 'MySQL Central + SQLite Local WAL',
    };
    const blob = new Blob([JSON.stringify(sampleExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `RMS_Full_System_Backup_${Date.now()}.json`;
    a.click();
  };

  return (
    <div className="settings-page">
      <div className="settings-header">
        <div>
          <h2>System Configuration & Settings</h2>
          <p>
            Configure business information, Kenyan Shilling (KES) currency, tax rules, and backups.
          </p>
        </div>

        <button
          onClick={handleExportData}
          className="settings-export-button"
        >
          <FaDownload /> Export System Backup (JSON)
        </button>
      </div>

      {savedMessage && (
        <div className="settings-success-message">
          ✓ Configuration settings saved successfully!
        </div>
      )}

      <form onSubmit={handleSaveSettings} className="settings-form">
        {/* Business Information */}
        <div className="settings-section">
          <h3>
            <FaBuilding className="text-amber-500" /> Business Profile & Branding
          </h3>

          <div className="settings-grid settings-grid-two">
            <div>
              <label>Business / Brand Name</label>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="settings-input"
              />
            </div>

            <div>
              <label>Support Email Address</label>
              <input
                type="email"
                value={supportEmail}
                onChange={(e) => setSupportEmail(e.target.value)}
                className="settings-input"
              />
            </div>

            <div>
              <label>Support Phone / Hotlines</label>
              <input
                type="text"
                value={supportPhone}
                onChange={(e) => setSupportPhone(e.target.value)}
                className="settings-input"
              />
            </div>

            <div>
              <label>Tax / VAT Registration PIN (KRA)</label>
              <input
                type="text"
                value={taxPin}
                onChange={(e) => setTaxPin(e.target.value)}
                className="settings-input settings-code-input"
              />
            </div>

            <div className="settings-logo-field">
              <label>Receipt & Portal Logo</label>
              <div className="settings-logo-controls">
                {logo ? <img src={logo} alt="Current business logo" className="settings-logo-preview" /> : <span className="settings-logo-placeholder">No logo</span>}
                <label className="settings-logo-button">
                  <FaDownload /> Choose Logo
                  <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleLogoChange} hidden />
                </label>
              </div>
              <p className="settings-help">Used on the login page, sidebar, thermal receipts, and reports.</p>
            </div>
          </div>
        </div>

        {/* Currency & Exchange Rates */}
        <div className="settings-section">
          <h3>
            <FaMoneyBillWave className="text-amber-500" /> System Currency & International Exchange
          </h3>

          <div className="settings-grid settings-grid-two">
            <div>
              <label>System Primary Currency</label>
              <input
                type="text"
                disabled
                value="KES - Kenyan Shilling (Primary)"
                className="settings-input"
              />
              <p className="settings-help">All properties, walk-ins, cash, and M-Pesa are priced in KES.</p>
            </div>

            <div>
              <label>USD Exchange Rate (for PayPal)</label>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-neutral-600">1 USD = </span>
                <input
                  type="number"
                  min="1"
                  value={usdRate}
                  onChange={(e) => setUsdRate(parseFloat(e.target.value))}
                  className="flex-1 px-3 py-2 bg-neutral-50 border border-neutral-300 rounded-lg text-xs font-bold"
                />
                <span className="text-xs font-bold text-neutral-600">KES</span>
              </div>
              <p className="settings-help">Used to convert KES bills to USD on PayPal checkout.</p>
            </div>
          </div>
        </div>

        {/* Taxes and Pricing Rules */}
        <div className="settings-section">
          <h3>
            <FaPercentage className="text-amber-500" /> Taxes, Fees & Dynamic Pricing Rules
          </h3>

          <div className="settings-grid settings-grid-three">
            <div>
              <label>Default VAT / Tax Rate (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={taxRate}
                onChange={(e) => setTaxRate(parseFloat(e.target.value))}
                className="settings-input"
              />
            </div>

            <div>
              <label>Online Platform Service Fee (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={serviceFee}
                onChange={(e) => setServiceFee(parseFloat(e.target.value))}
                className="settings-input"
              />
            </div>

            <div>
              <label>Weekend Surge Multiplier (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={weekendSurge}
                onChange={(e) => setWeekendSurge(parseFloat(e.target.value))}
                className="settings-input"
              />
            </div>
          </div>
        </div>

        {/* Active Promotional Codes */}
        <div className="settings-section">
          <h3>
            <FaTag className="text-amber-500" /> Active Promotional Coupons
          </h3>

          <div className="settings-grid settings-grid-two">
            <div className="coupon-row">
              <div>
                <span className="font-mono font-bold text-neutral-900 text-sm block">WELCOME10</span>
                <span className="text-neutral-500">10% discount for first-time customer bookings</span>
              </div>
              <span className="badge-confirmed">Active</span>
            </div>

            <div className="coupon-row">
              <div>
                <span className="font-mono font-bold text-neutral-900 text-sm block">SUMMER20</span>
                <span className="text-neutral-500">20% discount on vacation Airbnb villas</span>
              </div>
              <span className="badge-confirmed">Active</span>
            </div>
          </div>
        </div>

        <div className="settings-actions">
          <button type="submit" className="btn-primary">
            <FaSave /> Save Configuration
          </button>
        </div>
      </form>
    </div>
  );
}

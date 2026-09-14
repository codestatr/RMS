const KEY = 'rms_pending_booking';

export function savePendingBooking(draftBooking) {
  if (!draftBooking) return;
  sessionStorage.setItem(KEY, JSON.stringify(draftBooking));
}

export function getPendingBooking() {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function consumePendingBooking() {
  const booking = getPendingBooking();
  sessionStorage.removeItem(KEY);
  return booking;
}

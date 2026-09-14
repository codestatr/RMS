# RMS Product Differentiation

## Market Scan

Representative products reviewed:

- [Hostaway features](https://www.hostaway.com/features/): channel management, unified inbox, automated messaging, dynamic pricing, task management, direct booking, payments, owner reporting, and AI revenue management.
- [Hospitable features](https://hospitable.com/features/): AI replies and guest summaries, automated messages and reviews, unified inbox, channel management, dynamic pricing, task coordination, direct booking, guest portal, and guest verification.
- [Cloudbeds HMS](https://www.cloudbeds.com/hotel-management-software/): PMS, 300+ channel connections, booking engine, payments, revenue intelligence, CRM, guest experience, marketing, and open integrations.
- [Airbnb terms and search guidance](https://www.airbnb.com/help/article/2908): search relevance is influenced by price, availability, images, reviews, service quality, cancellation history, booking ease, and guest preferences.

These products establish the generic category baseline. RMS should not compete by copying every global OTA integration or requiring smart locks and other dedicated hardware.

## RMS Position

**A local-first rental operating system for Kenya and East Africa.**

The strongest software-only advantages are:

1. **M-Pesa-first payment confidence**: verified callback-driven payment status, clear pending/paid states, receipts, deposits, and reminders.
2. **Verified Stay trust**: reviews are tied to a completed booking, moderated before publication, and visibly marked as verified.
3. **Low-connectivity operations**: Electron/POS offline queues, central reconciliation, idempotent sync, and explicit conflict states.
4. **Transparent KES stay economics**: nightly, weekly, and monthly options with VAT, deposits, remaining balances, and no surprise totals.
5. **Local operations layer**: check-in instructions, late-arrival requests, neighborhood guidance, cleaning/maintenance tasks, and referral attribution without hardware.

## Implemented Slice

The first differentiating slice is Verified Stay Reviews:

- A review requires a matching booking owned by the customer.
- Only `checked_out` stays are eligible.
- A booking can receive only one review.
- New reviews enter `pending` moderation rather than becoming public immediately.
- Approved reviews expose a `verifiedStay` flag and display a Verified stay label.

The next shipped slices are:

- M-Pesa checkout starts a real STK Push and polls the backend payment record.
- Customer payment success is shown only after the backend receives a successful M-Pesa callback.
- Customer Browse cards expose weekly and monthly KES plans alongside nightly pricing.
- Customers choose an arrival window and add arrival notes during booking.
- Arrival details are stored with the booking and shown in the customer dashboard.
- Customers can add local services to a booking: airport pickup, cleaning, laundry, early check-in, and late checkout.
- Add-ons are stored as booking line items and included in the server-calculated KES total with discount and VAT handling.
- Admin and cashier staff can approve, decline, and mark requested hospitality services fulfilled from the Guest Services Desk.
- Airport pickup requests include customer pickup location, requested date/time, and driver notes in the staff queue.
- Approved airport pickups can be assigned to a cashier/admin and progressed through assigned, en route, arrived, and completed states.
- Admins and cashiers have an in-app staff inbox for unread messages and role-based admin/cashier communication.
- Admin booking operations now use the central booking API, keeping website, POS, and admin booking states aligned.

## Recommended Next Releases

### P0: Payment and booking truth

- Add idempotency keys to booking and payment creation.
- Persist and validate discount codes and VAT server-side.
- Add customer-facing pending-payment recovery and payment reminders.

### P1: Local-first operations

- Add a sync outbox with retry count, last error, and conflict resolution UI.
- Add a customer-visible booking state: payment pending, awaiting approval, confirmed, checked in, checked out.
- Add service fulfillment status and staff assignment for local add-ons.

### P2: Demand and retention

- Add a stay-fit search mode using budget, duration, work/family needs, and neighborhood preferences.
- Add weekly/monthly value badges and vacancy-aware offers.
- Add referral links and agent commission attribution.
- Add owner statements and property-level revenue/occupancy recommendations.

## Product Guardrails

- Keep hardware integrations optional; all core workflows must work in a browser or offline desktop client.
- Keep KES and M-Pesa first-class while allowing other payment methods.
- Treat payment, booking, and review status as backend-owned facts.
- Avoid copying competitor branding, layouts, or proprietary content; use their public feature categories only for market comparison.

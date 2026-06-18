// Booking flow — replaces the alert() placeholder in index.html
// Injected via <script src="/src/components/booking.js"> at end of body

(function () {
  // ─── WISE PROOF UPLOAD MODAL ───
  function showWiseModal(wiseData) {
    const existing = document.getElementById('wiseModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'wiseModal';
    modal.style.cssText =
      'position:fixed;inset:0;background:rgba(20,18,16,0.88);z-index:600;display:flex;align-items:center;justify-content:center;padding:1rem';

    modal.innerHTML = `
      <div style="background:var(--white);max-width:480px;width:100%;border:2px solid var(--border);animation:slideUp 0.25s ease;max-height:90vh;overflow-y:auto">
        <div style="background:var(--bg);padding:1.5rem;border-bottom:2px solid var(--border);display:flex;justify-content:space-between;align-items:center">
          <div style="font-family:'Space Grotesk',sans-serif;font-size:0.72rem;font-weight:700;letter-spacing:0.18em;text-transform:uppercase">Pay with Wise</div>
          <button onclick="document.getElementById('wiseModal').remove()" style="background:none;border:none;cursor:pointer;font-size:1rem;width:32px;height:32px;display:flex;align-items:center;justify-content:center">✕</button>
        </div>
        <div style="padding:2rem">
          <div style="background:rgba(43,122,142,0.08);border:1px solid rgba(43,122,142,0.2);padding:1.25rem;margin-bottom:1.5rem">
            <div style="font-family:'DM Mono',monospace;font-size:0.58rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--ocean);margin-bottom:0.75rem;font-weight:600">Transfer Details</div>
            <table style="width:100%;font-size:0.8rem;border-collapse:collapse">
              <tr><td style="padding:4px 0;color:var(--text-muted);font-size:0.72rem">Account Name</td><td style="text-align:right;font-weight:600;color:var(--text)">${wiseData.account_name}</td></tr>
              <tr><td style="padding:4px 0;color:var(--text-muted);font-size:0.72rem">Email</td><td style="text-align:right;color:var(--text)">${wiseData.email}</td></tr>
              <tr><td style="padding:4px 0;color:var(--text-muted);font-size:0.72rem">Amount</td><td style="text-align:right;font-weight:700;color:var(--text);font-size:1rem">$${wiseData.amount.toLocaleString()} USD</td></tr>
              <tr><td style="padding:4px 0;color:var(--text-muted);font-size:0.72rem">Reference</td><td style="text-align:right;font-family:'DM Mono',monospace;color:var(--clay);font-weight:700">${wiseData.reference}</td></tr>
            </table>
          </div>

          <div style="background:rgba(196,120,74,0.08);border:1px solid rgba(196,120,74,0.2);padding:1rem;margin-bottom:1.5rem;font-family:'DM Mono',monospace;font-size:0.65rem;color:var(--clay-dark);line-height:1.7">
            ⚠️ Include your reference <strong>${wiseData.reference}</strong> in the payment description. We will verify and confirm your booking within 24 hours.
          </div>

          <div style="margin-bottom:1.25rem">
            <div style="font-family:'DM Mono',monospace;font-size:0.56rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--text-muted);margin-bottom:0.5rem">Upload Payment Proof (optional)</div>
            <input type="file" id="wiseProofFile" accept="image/*,.pdf" style="width:100%;border:1px solid var(--border-med);padding:8px;font-size:0.78rem;font-family:'Space Grotesk',sans-serif;background:var(--white)">
          </div>

          <button onclick="submitWiseProof('${wiseData.reference}')" style="width:100%;background:var(--text);color:var(--bg);border:none;padding:14px;font-size:0.65rem;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;cursor:pointer;font-family:'Space Grotesk',sans-serif">
            I've Sent the Payment →
          </button>
          <div style="font-family:'DM Mono',monospace;font-size:0.56rem;color:var(--text-muted);text-align:center;margin-top:0.75rem">
            We'll confirm within 24 hours · info@nosaracollective.com
          </div>
        </div>
      </div>`;
    document.body.appendChild(modal);
  }

  window.submitWiseProof = async function (reference) {
    const fileInput = document.getElementById('wiseProofFile');
    document.getElementById('wiseModal').remove();
    showSuccessScreen(reference, null, 'wise');
  };

  // ─── SUCCESS SCREEN ───
  function showSuccessScreen(reference, communityImpact, method) {
    const existing = document.getElementById('successModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'successModal';
    modal.style.cssText =
      'position:fixed;inset:0;background:rgba(20,18,16,0.88);z-index:600;display:flex;align-items:center;justify-content:center;padding:1rem';

    const impactLine = communityImpact
      ? `<div style="background:rgba(43,122,142,0.1);border:1px solid rgba(43,122,142,0.2);padding:1rem;margin-bottom:1.5rem;font-size:0.8rem;color:var(--ocean);line-height:1.7">🌱 <strong>$${communityImpact.toLocaleString()} goes directly to local Nosara families.</strong><br>Thank you for traveling with purpose.</div>`
      : '';

    const pendingNote = method === 'wise'
      ? `<div style="background:rgba(196,120,74,0.08);border:1px solid rgba(196,120,74,0.2);padding:1rem;margin-bottom:1.5rem;font-family:'DM Mono',monospace;font-size:0.65rem;color:var(--clay-dark);line-height:1.7">⏳ Your booking is pending payment verification. We'll confirm within 24 hours.</div>`
      : '';

    modal.innerHTML = `
      <div style="background:var(--white);max-width:440px;width:100%;border:2px solid var(--border);animation:slideUp 0.25s ease;padding:0">
        <div style="background:var(--text);padding:2rem;text-align:center">
          <div style="font-size:2rem;margin-bottom:0.5rem">✓</div>
          <div style="font-family:'Space Grotesk',sans-serif;font-size:1.1rem;font-weight:700;color:var(--bg);letter-spacing:0.04em;text-transform:uppercase">${method === 'wise' ? 'Reservation Received' : 'Booking Confirmed'}</div>
        </div>
        <div style="padding:2rem">
          <div style="font-family:'DM Mono',monospace;font-size:0.6rem;color:var(--text-muted);letter-spacing:0.12em;text-transform:uppercase;margin-bottom:0.3rem">Your Reference</div>
          <div style="font-family:'Cormorant Garamond',serif;font-size:2rem;font-weight:300;color:var(--clay);margin-bottom:1.5rem">${reference}</div>
          ${impactLine}
          ${pendingNote}
          <div style="font-size:0.78rem;color:var(--text-muted);line-height:1.8;margin-bottom:1.5rem">A confirmation email has been sent to your inbox. Save your reference number for any questions.</div>
          <button onclick="document.getElementById('successModal').remove();document.getElementById('modalOverlay')?.classList.remove('open');document.body.style.overflow=''" style="width:100%;background:var(--text);color:var(--bg);border:none;padding:14px;font-size:0.65rem;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;cursor:pointer;font-family:'Space Grotesk',sans-serif">
            Done
          </button>
          <div style="text-align:center;margin-top:1rem">
            <a href="https://wa.me/50612345678" style="font-family:'DM Mono',monospace;font-size:0.6rem;color:var(--clay);letter-spacing:0.1em;text-transform:uppercase;text-decoration:none">💬 WhatsApp Us</a>
          </div>
        </div>
      </div>`;
    document.body.appendChild(modal);
  }

  // ─── PAYPAL CAPTURE (called from PayPal SDK onApprove) ───
  window._nccPayPalCapture = async function (orderId, reservationId, reference, communityImpact) {
    // PayPal captures server-side via webhook; just show success
    showSuccessScreen(reference, communityImpact, 'paypal');
  };

  // ─── OVERRIDE submitBooking ───
  // The original function is defined in index.html. We override it here.
  window.submitBooking = async function () {
    const ci = document.getElementById('checkin')?.value;
    const co = document.getElementById('checkout')?.value;
    if (!ci || !co) {
      if (window.showCalMsg) showCalMsg('Please select check-in and check-out dates.');
      return;
    }

    if (!window.curProp) return;

    if (window.isRangeBlocked && isRangeBlocked(curProp.id, ci, co)) {
      if (window.showCalMsg) showCalMsg('⚠️ Those dates are not available.', '#E07070');
      return;
    }

    const guestName = document.getElementById('guestName')?.value?.trim();
    const guestEmail = document.getElementById('guestEmail')?.value?.trim();
    const guestPhone = document.getElementById('guestPhone')?.value?.trim();
    const numGuests = document.getElementById('numGuests')?.value;
    const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value || 'paypal';

    if (!guestName || !guestEmail) {
      alert('Please fill in your name and email.');
      return;
    }

    const btn = document.querySelector('.book-btn');
    if (btn) { btn.textContent = 'Processing...'; btn.disabled = true; }

    try {
      const res = await fetch('/api/create-reservation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property_id: curProp.dbId || curProp.id, // dbId = UUID from Supabase
          guest_name: guestName,
          guest_email: guestEmail,
          guest_phone: guestPhone || null,
          guest_country: document.getElementById('guestCountry')?.value || null,
          check_in: ci,
          check_out: co,
          num_guests: parseInt(numGuests) || 1,
          payment_method: paymentMethod,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || 'Reservation failed. Please try again.');
        return;
      }

      if (paymentMethod === 'paypal' && data.paypal_approval_url) {
        // Redirect to PayPal
        window.location.href = data.paypal_approval_url;
      } else if (paymentMethod === 'wise') {
        showWiseModal(data.wise_instructions);
      }
    } catch (e) {
      console.error('Booking error:', e);
      alert('Connection error. Please try again or contact us on WhatsApp.');
    } finally {
      if (btn) { btn.textContent = 'Reserve Now'; btn.disabled = false; }
    }
  };

  // ─── HANDLE PAYPAL RETURN URL ───
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('payment') === 'success') {
    const ref = urlParams.get('ref');
    if (ref) {
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
      // Show success (webhook handles DB update; this is just UX feedback)
      setTimeout(() => showSuccessScreen(ref, null, 'paypal'), 500);
    }
  }
})();

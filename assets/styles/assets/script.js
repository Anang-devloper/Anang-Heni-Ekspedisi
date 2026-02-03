// Simple interactivity for Anang Heni Ekspedisi static site
document.addEventListener('DOMContentLoaded', function () {
  // Year in footer
  const y = new Date().getFullYear();
  document.getElementById('year').textContent = y;

  // Mobile Nav Toggle
  const navToggle = document.getElementById('nav-toggle');
  const mainNav = document.getElementById('main-nav');
  navToggle.addEventListener('click', () => {
    const shown = mainNav.style.display === 'flex';
    mainNav.style.display = shown ? 'none' : 'flex';
  });

  // Demo tracking - replace with real API call
  const trackingForm = document.getElementById('tracking-form');
  const trackingResult = document.getElementById('tracking-result');
  const demoData = {
    'ANH1234567890': [
      { time: '2026-02-01 09:12', status: 'Diterima di gudang asal - Jakarta' },
      { time: '2026-02-01 15:05', status: 'Berangkat ke depo regional' },
      { time: '2026-02-02 08:25', status: 'Dalam pengiriman - Dalam kota' }
    ],
    'ANH0001112223': [
      { time: '2026-01-28 10:00', status: 'Diterima - Surabaya' },
      { time: '2026-01-29 07:00', status: 'Tiba di depot tujuan - Malang' },
      { time: '2026-01-29 12:40', status: 'Terkirim' }
    ]
  };

  trackingForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const tn = document.getElementById('tn').value.trim().toUpperCase();
    trackingResult.innerHTML = '<p class="muted">Mencari resi…</p>';
    setTimeout(() => {
      if (demoData[tn]) {
        let html = '<ul>';
        demoData[tn].forEach(event => {
          html += `<li><strong>${escapeHtml(event.status)}</strong><br/><small class="muted">${escapeHtml(event.time)}</small></li>`;
        });
        html += '</ul>';
        trackingResult.innerHTML = html;
      } else {
        trackingResult.innerHTML = '<p class="muted">Resi tidak ditemukan di data demo. Untuk data real-time, hubungkan API kurir atau backend Anda.</p>';
      }
    }, 600);
  });

  // Simple form validation hint for quote form
  const quoteForm = document.getElementById('quote-form');
  quoteForm.addEventListener('submit', (e) => {
    // Let browser handle validation for required attributes, but can add custom checks here.
    // This example does nothing additional; form will POST to configured action (e.g., FormSubmit).
  });

  // small helper
  function escapeHtml(s){ return s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;') }
});

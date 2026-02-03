// Interactivity: tracking + demo + geolocation + courier slug handling
// Shows demo banner if server indicates demo mode.

document.addEventListener('DOMContentLoaded', function () {
  // Year
  const y = new Date().getFullYear();
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = y;

  // Mobile Nav Toggle
  const navToggle = document.getElementById('nav-toggle');
  const mainNav = document.getElementById('main-nav');
  if (navToggle && mainNav) {
    navToggle.addEventListener('click', () => {
      const shown = mainNav.style.display === 'flex';
      mainNav.style.display = shown ? 'none' : 'flex';
    });
  }

  // Elements
  const trackingForm = document.getElementById('tracking-form');
  const trackingResult = document.getElementById('tracking-result');
  const trackDemoBtn = document.getElementById('track-demo-btn');
  const demoBanner = document.getElementById('demo-banner');

  const courierSelect = document.getElementById('courier');
  const courierOther = document.getElementById('courier-other');

  if (courierSelect && courierOther) {
    courierSelect.addEventListener('change', () => {
      if (courierSelect.value === 'other') {
        courierOther.style.display = 'inline-block';
        courierOther.focus();
      } else {
        courierOther.style.display = 'none';
        courierOther.value = '';
      }
    });
  }

  // Demo data
  const demoData = {
    'ANH1234567890': [
      { time: '2026-02-01 09:12', status: 'Diterima di gudang asal - Jakarta', location: 'Jakarta, ID' },
      { time: '2026-02-01 15:05', status: 'Berangkat ke depo regional', location: 'Jakarta, ID' },
      { time: '2026-02-02 08:25', status: 'Dalam pengiriman - Dalam kota', location: 'Jakarta, ID' }
    ],
    'ANH0001112223': [
      { time: '2026-01-28 10:00', status: 'Diterima - Surabaya', location: 'Surabaya, ID' },
      { time: '2026-01-29 07:00', status: 'Tiba di depot tujuan - Malang', location: 'Malang, ID' },
      { time: '2026-01-29 12:40', status: 'Terkirim', location: 'Malang, ID' }
    ]
  };

  // Submit handler
  if (trackingForm) {
    trackingForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const tn = (document.getElementById('tn')?.value || '').trim().toUpperCase();
      if (!tn) return;

      let slug = null;
      if (courierSelect) {
        if (courierSelect.value === 'other' && courierOther) {
          slug = (courierOther.value || '').trim();
        } else if (courierSelect.value && courierSelect.value !== 'auto') {
          slug = courierSelect.value;
        }
      }

      trackingResult.innerHTML = '<p class="muted">Mencari resi…</p>';
      try {
        const body = { trackingNumber: tn };
        if (slug) body.slug = slug;
        const res = await fetch('/api/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        const data = await res.json();

        // Show demo banner if server in demo mode
        if (data && (data.provider === 'demo' || data.demo_mode)) {
          if (demoBanner) demoBanner.style.display = 'block';
        } else {
          if (demoBanner) demoBanner.style.display = 'none';
        }

        renderTrackingResult(data);
      } catch (err) {
        trackingResult.innerHTML = `<p class="muted">Terjadi kesalahan saat mengakses server pelacakan: ${escapeHtml(String(err))}</p>`;
      }
    });
  }

  // Demo button
  if (trackDemoBtn) {
    trackDemoBtn.addEventListener('click', () => {
      const tn = (document.getElementById('tn')?.value || '').trim().toUpperCase();
      if (!tn) return;
      if (demoData[tn]) {
        if (demoBanner) demoBanner.style.display = 'block';
        renderTrackingResult({ ok: true, provider: 'demo', demo_mode: true, tracking: { tracking_number: tn, checkpoints: demoData[tn] } });
      } else {
        renderTrackingResult({ ok: false, message: 'Resi tidak ditemukan di demo. Untuk hasil real-time, tambahkan AfterShip API key di environment dan/atau masukkan slug kurir.' });
      }
    });
  }

  function renderTrackingResult(data) {
    if (!data) {
      trackingResult.innerHTML = '<p class="muted">Tidak ada data.</p>';
      return;
    }
    if (!data.ok) {
      const msg = data.message || 'Resi tidak ditemukan';
      trackingResult.innerHTML = `<p class="muted">${escapeHtml(msg)}</p>`;
      if (data.raw) {
        trackingResult.innerHTML += `<pre class="muted" style="margin-top:.5rem">${escapeHtml(JSON.stringify(data.raw, null, 2))}</pre>`;
      }
      return;
    }
    const tracking = data.tracking || data;
    const checkpoints = tracking.checkpoints || [];
    if (checkpoints.length) {
      let html = `<h4 style="margin-top:0">Resi: ${escapeHtml(tracking.tracking_number || '')}</h4><ul>`;
      checkpoints.forEach(cp => {
        html += `<li><strong>${escapeHtml(cp.status || '')}</strong><br/><small class="muted">${escapeHtml(cp.time || '')}${cp.location ? ' — ' + escapeHtml(cp.location) : ''}</small></li>`;
      });
      html += '</ul>';
      trackingResult.innerHTML = html;
      return;
    }
    trackingResult.innerHTML = `<pre class="muted">${escapeHtml(JSON.stringify(data, null, 2))}</pre>`;
  }

  // Geolocation
  const useLocationBtn = document.getElementById('use-location-btn');
  const destinationInput = document.getElementById('destination');
  const originInput = document.getElementById('origin');

  if (useLocationBtn) {
    useLocationBtn.addEventListener('click', async () => {
      if (!navigator.geolocation) {
        alert('Geolocation tidak didukung oleh browser ini.');
        return;
      }
      useLocationBtn.disabled = true;
      useLocationBtn.textContent = 'Memeriksa lokasi…';
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        try {
          const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`;
          const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
          const json = await res.json();
          const display = json.display_name || `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
          if (destinationInput) destinationInput.value = display;
          if (originInput && !originInput.value) originInput.value = display;
        } catch (err) {
          alert('Gagal mengambil alamat dari koordinat. Silakan coba lagi atau isi manual.');
        } finally {
          useLocationBtn.disabled = false;
          useLocationBtn.textContent = 'Gunakan Lokasi Saya';
        }
      }, (err) => {
        alert('Gagal mendapatkan lokasi: ' + err.message);
        useLocationBtn.disabled = false;
        useLocationBtn.textContent = 'Gunakan Lokasi Saya';
      }, { enableHighAccuracy: true, timeout: 10000 });
    });
  }

  function escapeHtml(s){ return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;') }
});      }
    });
  }

  // Demo data
  const demoData = {
    'ANH1234567890': [
      { time: '2026-02-01 09:12', status: 'Diterima di gudang asal - Jakarta', location: 'Jakarta, ID' },
      { time: '2026-02-01 15:05', status: 'Berangkat ke depo regional', location: 'Jakarta, ID' },
      { time: '2026-02-02 08:25', status: 'Dalam pengiriman - Dalam kota', location: 'Jakarta, ID' }
    ],
    'ANH0001112223': [
      { time: '2026-01-28 10:00', status: 'Diterima - Surabaya', location: 'Surabaya, ID' },
      { time: '2026-01-29 07:00', status: 'Tiba di depot tujuan - Malang', location: 'Malang, ID' },
      { time: '2026-01-29 12:40', status: 'Terkirim', location: 'Malang, ID' }
    ]
  };

  // Submit handler
  if (trackingForm) {
    trackingForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const tn = (document.getElementById('tn')?.value || '').trim().toUpperCase();
      if (!tn) return;

      let slug = null;
      if (courierSelect) {
        if (courierSelect.value === 'other' && courierOther) {
          slug = (courierOther.value || '').trim();
        } else if (courierSelect.value && courierSelect.value !== 'auto') {
          slug = courierSelect.value;
        }
      }

      trackingResult.innerHTML = '<p class="muted">Mencari resi…</p>';
      try {
        const body = { trackingNumber: tn };
        if (slug) body.slug = slug;
        const res = await fetch('/api/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        const data = await res.json();

        // Show demo banner if server in demo mode
        if (data && (data.provider === 'demo' || data.demo_mode)) {
          if (demoBanner) demoBanner.style.display = 'block';
        } else {
          if (demoBanner) demoBanner.style.display = 'none';
        }

        renderTrackingResult(data);
      } catch (err) {
        trackingResult.innerHTML = `<p class="muted">Terjadi kesalahan saat mengakses server pelacakan: ${escapeHtml(String(err))}</p>`;
      }
    });
  }

  // Demo button
  if (trackDemoBtn) {
    trackDemoBtn.addEventListener('click', () => {
      const tn = (document.getElementById('tn')?.value || '').trim().toUpperCase();
      if (!tn) return;
      if (demoData[tn]) {
        if (demoBanner) demoBanner.style.display = 'block';
        renderTrackingResult({ ok: true, provider: 'demo', demo_mode: true, tracking: { tracking_number: tn, checkpoints: demoData[tn] } });
      } else {
        renderTrackingResult({ ok: false, message: 'Resi tidak ditemukan di demo. Untuk hasil real-time, tambahkan AfterShip API key di environment dan/atau masukkan slug kurir.' });
      }
    });
  }

  function renderTrackingResult(data) {
    if (!data) {
      trackingResult.innerHTML = '<p class="muted">Tidak ada data.</p>';
      return;
    }
    if (!data.ok) {
      const msg = data.message || 'Resi tidak ditemukan';
      trackingResult.innerHTML = `<p class="muted">${escapeHtml(msg)}</p>`;
      if (data.raw) {
        trackingResult.innerHTML += `<pre class="muted" style="margin-top:.5rem">${escapeHtml(JSON.stringify(data.raw, null, 2))}</pre>`;
      }
      return;
    }
    const tracking = data.tracking || data;
    const checkpoints = tracking.checkpoints || [];
    if (checkpoints.length) {
      let html = `<h4 style="margin-top:0">Resi: ${escapeHtml(tracking.tracking_number || '')}</h4><ul>`;
      checkpoints.forEach(cp => {
        html += `<li><strong>${escapeHtml(cp.status || '')}</strong><br/><small class="muted">${escapeHtml(cp.time || '')}${cp.location ? ' — ' + escapeHtml(cp.location) : ''}</small></li>`;
      });
      html += '</ul>';
      trackingResult.innerHTML = html;
      return;
    }
    trackingResult.innerHTML = `<pre class="muted">${escapeHtml(JSON.stringify(data, null, 2))}</pre>`;
  }

  // Geolocation
  const useLocationBtn = document.getElementById('use-location-btn');
  const destinationInput = document.getElementById('destination');
  const originInput = document.getElementById('origin');

  if (useLocationBtn) {
    useLocationBtn.addEventListener('click', async () => {
      if (!navigator.geolocation) {
        alert('Geolocation tidak didukung oleh browser ini.');
        return;
      }
      useLocationBtn.disabled = true;
      useLocationBtn.textContent = 'Memeriksa lokasi…';
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        try {
          const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`;
          const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
          const json = await res.json();
          const display = json.display_name || `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
          if (destinationInput) destinationInput.value = display;
          if (originInput && !originInput.value) originInput.value = display;
        } catch (err) {
          alert('Gagal mengambil alamat dari koordinat. Silakan coba lagi atau isi manual.');
        } finally {
          useLocationBtn.disabled = false;
          useLocationBtn.textContent = 'Gunakan Lokasi Saya';
        }
      }, (err) => {
        alert('Gagal mendapatkan lokasi: ' + err.message);
        useLocationBtn.disabled = false;
        useLocationBtn.textContent = 'Gunakan Lokasi Saya';
      }, { enableHighAccuracy: true, timeout: 10000 });
    });
  }

  function escapeHtml(s){ return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;') }
});        let html = '<ul>';
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

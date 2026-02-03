// api/track.js
// Vercel Serverless Function — AfterShip integration (robust) + in-memory cache
//
// Usage:
// POST /api/track  with JSON { trackingNumber: 'ANH123...', slug: 'jne' }
// Environment variables (set these in Vercel Project Settings):
// - TRACKING_PROVIDER = aftership
// - AFTERSHIP_API_KEY = <your_aftership_api_key>
//
// Notes about cache:
// - This file uses a simple in-memory cache stored on globalThis so it can survive
//   multiple invocations while the serverless instance is warm. This is ephemeral:
//   it does not persist across cold starts or across multiple instances. For
//   production use Vercel KV / Redis / an external cache for reliable caching.
//
// Response shape (normalized):
// {
//   ok: true,
//   provider: 'aftership',
//   tracking: {
//     tracking_number: 'ANH123...',
//     slug: 'jne',
//     title: '...',
//     checkpoints: [ { time, status, location }, ... ]
//   }
// }

const AFTERSHIP_BASE = 'https://api.aftership.com/v4';

const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Initialize global cache (survives warm invocations)
if (!globalThis.__TRACKING_CACHE) {
  globalThis.__TRACKING_CACHE = new Map(); // key -> { expires: number, value: any }
}

function cacheGet(key) {
  try {
    const entry = globalThis.__TRACKING_CACHE.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expires) {
      globalThis.__TRACKING_CACHE.delete(key);
      return null;
    }
    return entry.value;
  } catch (e) {
    return null;
  }
}

function cacheSet(key, value, ttlMs = DEFAULT_CACHE_TTL_MS) {
  try {
    globalThis.__TRACKING_CACHE.set(key, { expires: Date.now() + ttlMs, value });
  } catch (e) {
    // ignore cache errors
  }
}

function safeJsonParse(text) {
  try { return JSON.parse(text); } catch(e) { return null; }
}

function normalizeCheckpoint(cp) {
  // cp: raw checkpoint object returned by AfterShip (various fields possible)
  const time = cp.checkpoint_time || cp.created_at || cp.updated_at || cp.occurred_at || cp.time || cp.checkpoint_utc_time || null;
  const status = cp.message || cp.tag || cp.description || cp.status || cp.checkpoint_status || cp.status_description || '';
  const parts = [];
  if (cp.city) parts.push(cp.city);
  if (cp.state) parts.push(cp.state);
  if (cp.country_name) parts.push(cp.country_name);
  if (cp.location) parts.push(cp.location);
  if (cp.address) parts.push(cp.address);
  const location = parts.join(', ') || '';
  return { time, status, location };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, message: 'Method Not Allowed' });
    return;
  }

  const body = req.body || {};
  const trackingNumberRaw = body.trackingNumber || body.tracking_number || '';
  if (!trackingNumberRaw) {
    res.status(400).json({ ok: false, message: 'trackingNumber is required' });
    return;
  }
  const tn = String(trackingNumberRaw).trim().toUpperCase();
  const rawSlug = body.slug || body.courier || body.slug || '';
  const slug = rawSlug && String(rawSlug).trim().toLowerCase() && rawSlug !== 'auto' ? String(rawSlug).trim().toLowerCase() : null;

  const cacheKey = `aftership:${slug || 'auto'}:${tn}`;
  const cached = cacheGet(cacheKey);
  if (cached) {
    // Return cached copy but mark provider and that it came from cache
    res.status(200).json(Object.assign({}, cached, { cached: true }));
    return;
  }

  const PROVIDER = (process.env.TRACKING_PROVIDER || '').toLowerCase();
  const AFTERSHIP_KEY = process.env.AFTERSHIP_API_KEY;

  // Demo/fallback when AfterShip not configured
  if (!AFTERSHIP_KEY || PROVIDER !== 'aftership') {
    // If you want, keep demo dataset here (demoNumber -> checkpoints)
    const demoData = {
      'ANH1234567890': [
        { time: '2026-02-01 09:12', status: 'Diterima di gudang asal - Jakarta', location: 'Jakarta, ID' },
        { time: '2026-02-01 15:05', status: 'Berangkat ke depo regional', location: 'Jakarta, ID' },
        { time: '2026-02-02 08:25', status: 'Dalam pengiriman - Dalam kota', location: 'Jakarta, ID' }
      ]
    };
    if (demoData[tn]) {
      const payload = {
        ok: true,
        provider: 'demo',
        demo_mode: true,
        tracking: { tracking_number: tn, slug: null, title: 'Demo tracking', checkpoints: demoData[tn] }
      };
      cacheSet(cacheKey, payload, 60 * 1000); // short cache for demo
      res.status(200).json(payload);
      return;
    }
    res.status(200).json({
      ok: false,
      demo_mode: true,
      message: 'Pelacakan real-time belum diaktifkan. Set TRACKING_PROVIDER=aftership and AFTERSHIP_API_KEY di environment untuk mengaktifkan.'
    });
    return;
  }

  // Helper to call AfterShip POST create tracking
  async function aftershipCreate(trackingNumber, slugOpt = null) {
    const url = `${AFTERSHIP_BASE}/trackings`;
    const payload = { tracking: { tracking_number: trackingNumber } };
    if (slugOpt) payload.tracking.slug = slugOpt;
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'aftership-api-key': AFTERSHIP_KEY
      },
      body: JSON.stringify(payload)
    });
    const text = await resp.text();
    const json = safeJsonParse(text) || { raw: text };
    return { ok: resp.ok, status: resp.status, json };
  }

  // Helper to GET existing tracking
  async function aftershipGet(trackingNumber, slugOpt = null) {
    // Prefer slug path if provided
    const url = slugOpt
      ? `${AFTERSHIP_BASE}/trackings/${encodeURIComponent(slugOpt)}/${encodeURIComponent(trackingNumber)}`
      : `${AFTERSHIP_BASE}/trackings/${encodeURIComponent(trackingNumber)}`;
    const resp = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'aftership-api-key': AFTERSHIP_KEY
      }
    });
    const text = await resp.text();
    const json = safeJsonParse(text) || { raw: text };
    return { ok: resp.ok, status: resp.status, json };
  }

  try {
    // First try creating tracking (AfterShip will create or return existing)
    const createResp = await aftershipCreate(tn, slug);

    // If create succeeded (201/200), extract tracking from createResp.json.data.tracking
    if (createResp.ok) {
      const trackingObj = createResp.json?.data?.tracking || createResp.json?.tracking || null;
      if (!trackingObj) {
        // unexpected shape: return raw for debugging
        res.status(200).json({ ok: false, message: 'AfterShip returned unexpected payload on create', raw: createResp.json });
        return;
      }
      const checkpointsRaw = Array.isArray(trackingObj.checkpoints) ? trackingObj.checkpoints : (trackingObj.checkpoint ? [trackingObj.checkpoint] : []);
      const checkpoints = checkpointsRaw.map(normalizeCheckpoint);
      const payload = {
        ok: true,
        provider: 'aftership',
        tracking: {
          tracking_number: trackingObj.tracking_number || tn,
          slug: trackingObj.slug || slug || null,
          title: trackingObj.title || trackingObj.tag || null,
          checkpoints
        }
      };
      cacheSet(cacheKey, payload);
      res.status(200).json(payload);
      return;
    }

    // If create returned 409 or other non-ok, try GET to fetch existing tracking
    // Some AfterShip flows may return 409 or other status when tracking already exists.
    const getResp = await aftershipGet(tn, slug);
    if (getResp.ok) {
      const trackingObj = getResp.json?.data?.tracking || getResp.json?.tracking || null;
      if (!trackingObj) {
        res.status(200).json({ ok: false, message: 'AfterShip returned unexpected payload on get', raw: getResp.json });
        return;
      }
      const checkpointsRaw = Array.isArray(trackingObj.checkpoints) ? trackingObj.checkpoints : (trackingObj.checkpoint ? [trackingObj.checkpoint] : []);
      const checkpoints = checkpointsRaw.map(normalizeCheckpoint);
      const payload = {
        ok: true,
        provider: 'aftership',
        tracking: {
          tracking_number: trackingObj.tracking_number || tn,
          slug: trackingObj.slug || slug || null,
          title: trackingObj.title || trackingObj.tag || null,
          checkpoints
        }
      };
      cacheSet(cacheKey, payload);
      res.status(200).json(payload);
      return;
    }

    // Both create & get failed — forward helpful error (include raw jsons)
    res.status(502).json({
      ok: false,
      message: 'AfterShip request failed on create & get',
      create: createResp,
      get: getResp
    });
    return;

  } catch (err) {
    res.status(500).json({ ok: false, message: 'Internal error calling AfterShip: ' + String(err) });
    return;
  }
}

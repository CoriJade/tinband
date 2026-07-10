// api/shows.js  — Vercel serverless function
//
// Place this file at:  api/shows.js  (in your Vercel project root).
// It becomes available at:  https://tinband.vercel.app/api/shows
//
// It queries your Wix "Import1" collection using the Wix Data REST API.
// The API key MUST stay here on the server — Wix blocks browser calls with
// an API key (CORS), and you never want the key in client HTML anyway.
//
// SET THESE IN VERCEL (Project → Settings → Environment Variables), then redeploy:
//   WIX_API_KEY   = <your Wix API key>          (required)
//   WIX_SITE_ID   = a3716683-fd10-4581-a3c2-f2dccb8494d9   (optional; defaulted below)

const COLLECTION_ID = "Import1";
const DEFAULT_SITE_ID = "a3716683-fd10-4581-a3c2-f2dccb8494d9";

// Wix date fields can come back as {"$date":"..."} or a plain ISO string.
function isoDate(v) {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object" && v.$date) return v.$date;
  return "";
}

export default async function handler(req, res) {
  const API_KEY = process.env.WIX_API_KEY;
  const SITE_ID = process.env.WIX_SITE_ID || DEFAULT_SITE_ID;

  if (!API_KEY) {
    return res.status(500).json({ error: "WIX_API_KEY environment variable is not set in Vercel." });
  }

  try {
    const wixRes = await fetch("https://www.wixapis.com/wix-data/v2/items/query", {
      method: "POST",
      headers: {
        "Authorization": API_KEY,     // API key value, no "Bearer" prefix
        "wix-site-id": SITE_ID,       // site-level call
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        dataCollectionId: COLLECTION_ID,
        query: { paging: { limit: 1000 } }
      })
    });

    if (!wixRes.ok) {
      const detail = await wixRes.text();
      // Surface Wix's own error so you can see it at /api/shows if something's off.
      return res.status(wixRes.status).json({ error: "Wix API error", status: wixRes.status, detail });
    }

    const json = await wixRes.json();
    const rows = json.dataItems || json.items || [];

    const items = rows.map(r => {
      const f = r.data || r;   // v2 returns { data: {...} }
      return {
        show:         f.show || "",
        city:         f.city || "",
        stateCountry: f.stateCountry || "",
        country:      f.country || "",
        longDate:     f.longDate || "",
        date:         isoDate(f.date),
        latitude:     f.latitude,
        longitude:    f.longitude,
        ticketLink:   f.ticketLink || ""
      };
    });

    // Cache at Vercel's edge for 5 min so you're not hitting Wix on every visit.
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    return res.status(200).json({ items });

  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
}

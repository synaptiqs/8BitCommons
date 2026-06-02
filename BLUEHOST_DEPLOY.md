# Deploying FlopSource to Bluehost (Current Architecture)

**Important**: This site now provides the AI analysis + conversational AI Consultation features as a **service you control** via a Cloudflare Worker.  
**No user API keys are ever required or asked for.**

**Note**: The marketing landing page (primary entry + lead-gen surface) and `affiliates.html` are also hosted here at the root domain. The heavier directory tool lives in the `website/` folder (or a subfolder).

---

## What Gets Uploaded

Only the contents of the `website/` folder go to Bluehost.

### For the Directory Tool (if hosting it here):
- `website/` contents (or copy `flopsourcedirectory.html`, `js/`, `data/` into a subfolder)

### For the Marketing Landing + Affiliates (primary entry point):
- Root `index.html`
- `affiliates.html`
- Any shared assets needed for the landing page

### Do NOT upload:
- `test-ai-backend.html` (development testing tool only)
- Any `.bat`, `.ps1`, or `.md` files
- `temp-dark-bento-preview.html`
- The root `FlopSource` folder or anything outside `website/`

---

## Step-by-Step Upload (cPanel File Manager)

1. Log into Bluehost → cPanel → **File Manager**
2. Go to `public_html`
3. (Recommended) Create a subfolder, e.g. `flopsource`
4. Open that folder
5. Upload the three items listed above (`index.html`, `js/`, `data/`)
6. Visit your site (e.g. `https://yoursite.com/flopsource`)

---

## Critical: Cloudflare Worker (AI Backend)

The AI features ("Custom AI Analysis" + conversational "AI Consultation" widget) are powered by your Cloudflare Worker:

**Current worker URL** (as of last update):
```
https://flopsourceadvisor.synaptiqs.workers.dev
```

This is already set in:
- `website/js/api.js` → `BACKEND_URL`
- The test file (for local validation)

### Before going live on Bluehost — tighten CORS

1. Go to Cloudflare → Workers & Pages → your worker (`flopsourceadvisor`)
2. Edit the code
3. Change this line near the top:

```js
'Access-Control-Allow-Origin': '*',
```

to your actual domain, for example:

```js
'Access-Control-Allow-Origin': 'https://yoursite.com',
```

(or `'https://flopsource.com'` once you have the domain pointed).

4. Save and Deploy.

This is the only security step needed for the AI feature.

---

## How the AI Features Work on the Live Site

1. User selects 2–10 providers
2. Clicks **Compare Providers** in the floating tray
3. In the comparison modal they see two AI options:
   - **Custom AI Analysis** — Uses the selected "Use Case" (Balanced, Training, Inference, etc.) with weighted scoring
   - **AI Consultation** — Opens a dialog where the user types their actual needs in plain English (scale, latency, location, budget, workload type, etc.)

Both call your Cloudflare Worker (no keys, no rate limiting on the user side).

---

## Worker Maintenance

- The worker code lives in `workers/ai-proxy.js` (in this repo)
- Model currently used: `@cf/meta/llama-3.3-70b-instruct-fp8-fast` (via Cloudflare Workers AI)
- To change the model later: edit the default in the worker and redeploy
- Official model list: https://developers.cloudflare.com/workers-ai/models/

No secrets are required when using the native `env.AI` path.

---

## Recommended Bluehost Folder Structure

```
public_html/
├── flopsource/                  ← your site
│   ├── index.html
│   ├── js/
│   │   ├── api.js
│   │   ├── app.js
│   │   └── components.js
│   └── data/
│       └── data_centers.json
└── (other sites / files)
```

---

## Post-Deployment Checklist

- [ ] Test the site loads correctly
- [ ] Open comparison with 2+ providers
- [ ] Click **Custom AI Analysis** — confirm it returns a short analysis
- [ ] Click **AI Consultation** — type a sample requirement and confirm it works
- [ ] (Strongly recommended) Restrict CORS on the worker to your real domain
- [ ] Update the footer date in `index.html` if desired ("Data as of May 2026")

---

## Troubleshooting

**"Failed to fetch" on AI buttons after upload**
- The worker URL in `js/api.js` may be pointing to an old/deleted worker name
- Double-check the `BACKEND_URL` constant
- Confirm the worker is deployed and the health check works: `https://your-worker.workers.dev/`

**AI returns errors**
- Check the Network tab in DevTools on the failing request
- Most common: CORS not allowing your Bluehost domain yet

**Site looks broken**
- Make sure you uploaded the entire `js/` and `data/` folders (not just the files inside them)

---

**Architecture summary**: Static site on Bluehost + AI brains on your free Cloudflare Worker. Clean separation, no keys exposed to visitors.
# Deploying the FlopSource App to AWS

This document explains how to deploy the actual FlopSource directory (the full app) to Amazon Web Services.

**Note:** You mentioned needing to use **AWS Amplify** because your account requires verification to use CloudFront. That's perfectly fine — Amplify Hosting is actually a great fit (and often simpler) for static sites like this. It handles custom domains easily even with external registrars (Bluehost), provides HTTPS automatically, and has good performance.

The current `website/` folder contains the full directory application (the serious tool). The marketing landing page lives at the project root (`index.html`) and `affiliates.html` (kept on Bluehost for now).

For the directory tool, deploy the **contents of `website/`** to Amplify. The root landing + affiliates stay separate on the main domain.

---

## Recommended: Deploy with AWS Amplify

### 1. Prepare the App

The `website/` folder is already self-contained static files (index.html + js/, data/, CSS, favicons, etc.). All paths are relative, so it will work when served from the root of your Amplify hosting.

### 2. Deploy to Amplify (Easiest Options)

**Option A: Amplify Console (Manual / Drag & Drop - Recommended for first deploy)**

1. Go to the AWS Amplify Console: https://console.aws.amazon.com/amplify/
2. Click **"New app" > "Host web app"**.
3. Choose **"Deploy without Git provider"** (or connect your Git repo if you prefer).
4. Drag and drop the entire `website/` folder (or its contents) into the upload area.
5. Give your app a name (e.g. "flopsource-directory").
6. Click **Deploy**.

Amplify will build and host it. You'll get a URL like `https://<random-id>.amplifyapp.com`.

**Option B: Amplify CLI (if you have it installed)**

```bash
npm install -g @aws-amplify/cli
amplify init
amplify add hosting
amplify publish
```

(Choose "Hosting with Amplify Console" and point it at the `website/` folder or use manual deploy.)

### 3. Connect Your Custom Domain (directory.flopsource.com)

Since your domain is managed at Bluehost:

1. In your Amplify app, go to **Domain management** > **Add domain**.
2. Enter `directory.flopsource.com` (or the full subdomain you want).
3. Amplify will generate DNS records (usually a CNAME).
4. Go to your Bluehost DNS settings and add the CNAME record(s) Amplify provides.
5. Wait for propagation (can take a few minutes to hours). Amplify will issue a free SSL certificate automatically.

Once verified, your directory will be live at `https://directory.flopsource.com`.

### 4. Update the Landing Page

In the root `index.html` (your marketing landing), update the `REMOTE_DIRECTORY_URL`:

```js
const REMOTE_DIRECTORY_URL = 'https://your-amplify-domain.amplifyapp.com';  // or https://directory.flopsource.com
```

Then set `DIRECTORY_LIVE = true;` (and redeploy the landing page) when you're ready to switch from the "Launching Soon" / waitlist mode to live directory access (the email gate will still run for lead capture).

The landing page already has smart logic:
- On localhost → points to your local `/website/`
- Otherwise → uses the `REMOTE_DIRECTORY_URL` you set above

### 5. Update Links and Stats

The landing page automatically uses `DIRECTORY_URL` for:
- "Browse the Directory" buttons (after email gate)
- Dynamic GPU stats fetch from the live data

No other changes needed in the app code.

---

## Keeping the AI Backend

Your AI features (and lead capture) still call the Cloudflare Worker at:

```
https://flopsourceadvisor.synaptiqs.workers.dev
```

No changes required. The Amplify-hosted frontend can call it directly (CORS is already configured for the relevant domains).

---

## Current Recommended Split (Updated for Amplify)

| Location       | Purpose                        | Technology              |
|----------------|--------------------------------|-------------------------|
| Bluehost       | Marketing / Landing page       | Static HTML             |
| AWS Amplify    | Full FlopSource Directory App  | Amplify Hosting (static)|
| Cloudflare     | AI backend + lead capture      | Workers                 |

This keeps operational complexity low while giving you easy custom domains and HTTPS.

---

## Tips

- **Custom domain verification**: Amplify will show the exact records to add at Bluehost. Use the subdomain `directory.flopsource.com` to keep marketing (flopsource.com) separate from the tool.
- **Updates**: If using Git-connected Amplify, push changes to `website/` and it redeploys automatically. For manual deploys, just drag the updated `website/` folder again.
- **Local testing**: Keep using `serve.bat` from the root. The landing page detects localhost and points directory links to your local `website/` copy.
- **When going live**: Flip `DIRECTORY_LIVE = true` in the landing page, update the URL constant, and redeploy the landing. The email gate will continue to function (captures leads before granting access), and the directory will open properly.
- **Cost**: Amplify free tier is generous for low traffic. The directory is mostly static + calls to your Worker.

If you run into any issues during the Amplify setup (e.g., domain verification at Bluehost, or updating the landing page links), share the exact error or the Amplify domain you get and I can help with the next steps.

Would you like me to also update `STRUCTURE.md` and any other docs with the Amplify details? Or help with anything specific in the landing page (e.g. default placeholder URL)?

---

## Keeping the AI Backend

Your AI features (Custom AI Analysis + AI Consultation) currently call this Cloudflare Worker:

```
https://flopsourceadvisor.synaptiqs.workers.dev
```

You can (and should) **keep this exactly as-is**. 
The AWS-hosted frontend can call the same Worker without any changes.

Just make sure the `BACKEND_URL` in `website/js/api.js` is correct before uploading.

---

## Automation Ideas (Future)

Once you're comfortable, you can improve the workflow:

- Use **AWS Amplify** instead of manual S3 + CloudFront (easier Git deploys)
- Add a GitHub Action that runs `aws s3 sync` on every push to `main`
- Move the Python data pipeline to run on a schedule and upload fresh JSON to S3

---

## Current Recommended Split

| Location       | Purpose                        | Technology          |
|----------------|--------------------------------|---------------------|
| Bluehost       | Marketing / Landing page       | Static HTML         |
| AWS (S3 + CF)  | Full FlopSource Directory App  | Static (current site) |
| Cloudflare     | AI backend                     | Workers             |

This gives you a clean separation while keeping operational complexity low.

---

Would you like me to help you:
1. Create a dedicated `app/` folder structure?
2. Set up a simple GitHub Action for automated deploys to S3?
3. Improve the landing page further?
4. Update the current `website/js/api.js` BACKEND_URL comments for clarity?
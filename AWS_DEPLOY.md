# Deploying the FlopSource App to AWS

This document explains how to deploy the actual FlopSource directory (the full app) to Amazon Web Services.

## Recommended Architecture

**S3 + CloudFront** (Static website hosting)

This is the best fit for your current stack:
- Your frontend is mostly static (HTML + Tailwind CDN + vanilla JS)
- Your AI backend already lives on Cloudflare Workers (no need to move it)
- Very low cost and high performance

---

## Step-by-step Deployment

### 1. Prepare the App for AWS

The current `website/` folder contains the full directory application (the serious tool). The marketing landing page lives at the project root (`index.html`) and `affiliates.html`.

For the directory tool, deploy the contents of `website/`. The root landing + affiliates are deployed separately to the main domain (currently Bluehost).

### 2. Create an S3 Bucket for Static Hosting

1. Go to the AWS Console → S3
2. Create a new bucket (e.g. `flopsource-app`)
3. **Uncheck** "Block all public access"
4. After creation, go to the **Properties** tab → Static website hosting → Enable
5. Set:
   - Index document: `index.html`
   - Error document: `index.html` (for SPA-like behavior if needed later)

### 3. Upload the Files

You have two easy options:

**Option A: AWS CLI (Recommended)**
```bash
aws s3 sync website/ s3://flopsource-app --delete
```

**Option B: AWS Console**
- Go to your bucket → Upload
- Drag the entire contents of the `website/` folder (index.html, js/, data/)

### 4. Set Up CloudFront (Strongly Recommended)

S3 alone is slow globally. CloudFront gives you:
- Fast global CDN
- Custom domain + SSL
- Better caching

1. Go to CloudFront → Create distribution
2. Origin domain: Select your S3 bucket
3. Origin access: Choose **Origin access control (recommended)**
4. Default root object: `index.html`
5. Web Application Firewall: Optional (you can leave it off for now)
6. Create the distribution

After creation:
- Go to your distribution → **Error pages** → Create custom error response
  - HTTP Error Code: 403
  - Response Page Path: `/index.html`
  - HTTP Response Code: 200

This makes client-side routing (if you add any later) work properly.

### 5. Connect a Custom Domain (Optional but Recommended)

1. In CloudFront, go to your distribution → **Custom domain**
2. Add your domain (e.g. `app.flopsource.com` or `directory.flopsource.com`)
3. Create a certificate in ACM (us-east-1 region)
4. Update your DNS (Route 53 or your registrar) to point a CNAME to the CloudFront domain

### 6. Update the Landing Page Link

In your marketing landing page (root `index.html`), update this line:

```html
<a href="https://your-app-url-on-aws.com" ...>
```

Replace it with your actual CloudFront URL or custom domain.

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
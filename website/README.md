# FlopSource — Frontend

**Production B2B Directory for AI Compute Infrastructure**

This directory contains the complete static corporate frontend for the FlopSource enterprise directory.

## Tech Stack

- **Pure vanilla ES6+** (no frameworks, no build step required for v1)
- **Tailwind CSS** via official Play CDN + runtime configuration
- **Client-side filtering only** (instant, no API calls)
- Designed for direct hosting on AWS S3 + CloudFront

## Local Development

```bash
# Option 1: Python (recommended)
cd website
python -m http.server 8080

# Option 2: Node (if http-server installed)
npx http-server website -p 8080 -c-1
```

Then open http://localhost:8080

## File Structure

```
website/
├── index.html          # Main application shell
├── data/
│   └── data_centers.json   # Primary structured data source (18 providers)
├── js/
│   ├── app.js          # State management, filtering engine, orchestration
│   └── components.js   # Pure UI factories (cards, filters, modals)
└── README.md
```

## Deployment

Use the root-level `deploy.sh` script:

```bash
# From repository root
./deploy.sh --dry-run          # Preview
./deploy.sh                    # Deploy to S3 Express
./deploy.sh --invalidate       # Deploy + CloudFront invalidation
```

**Current target:** `8bitcommons--usw2-az1--x-s3` (S3 Express One Zone Directory Bucket in us-west-2-az1)

> **Note:** We are keeping this existing bucket for now. No migration to a new bucket will happen until the FlopSource Directory is considered mature.

**Important:** S3 Express One Zone buckets **do not support** traditional Static Website Hosting. You must serve this frontend through **CloudFront** using the S3 Express bucket as the origin.

**Required environment:**
- AWS CLI v2 with permissions for S3 Express (`s3express:CreateSession`, `s3:PutObject`, `s3:DeleteObject`, `s3:ListBucket`) on this bucket.

## Data Model

See `data/data_centers.json` for the full schema. All filtering dimensions are derived from this file at runtime:

- `layer_type`
- `hardware_architectures[]`
- `cooling_type`
- `jurisdiction_zone`

The application gracefully handles missing values ("Not disclosed").

## Production Notes

- All assets are cacheable for 1 year (adjust `deploy.sh` if you need more frequent updates).
- Add a custom domain + ACM certificate via CloudFront for production.
- Consider moving to a lightweight build step (Vite + Tailwind CLI) once the dataset exceeds ~300 providers.

## Questions?

Contact the infrastructure team or open an issue in the main repository.
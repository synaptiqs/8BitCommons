#!/usr/bin/env bash
#
# deploy.sh
# FlopSource — Production Frontend Deployment
#
# Syncs the static directory app to AWS S3 for hosting via CloudFront.
#
# Usage:
#   ./deploy.sh                    # Normal sync
#   ./deploy.sh --dry-run          # Preview changes only
#   ./deploy.sh --invalidate       # Also invalidate CloudFront (if configured)
#
set -euo pipefail

# ============================================
# CONFIGURATION
# ============================================
BUCKET_NAME="flopsource-compute-directory"
REGION="us-west-2"

SOURCE_DIR="website"
AWS_PROFILE="${AWS_PROFILE:-default}"
CACHE_CONTROL="public, max-age=31536000, immutable"

# Optional CloudFront Distribution ID for invalidation
CLOUDFRONT_DISTRIBUTION_ID="${CLOUDFRONT_DISTRIBUTION_ID:-}"

# ============================================
# ARGUMENT PARSING
# ============================================
DRY_RUN=false
INVALIDATE=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --invalidate)
      INVALIDATE=true
      shift
      ;;
    *)
      echo "Unknown argument: $1"
      echo "Usage: $0 [--dry-run] [--invalidate]"
      exit 1
      ;;
  esac
done

# ============================================
# PRE-FLIGHT CHECKS
# ============================================
echo "🚀 FlopSource Frontend Deployment"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Bucket:           s3://${BUCKET_NAME}"
echo "Source:           ${SOURCE_DIR}/"
echo "AWS Profile:      ${AWS_PROFILE}"
echo "Dry Run:          ${DRY_RUN}"
echo

if ! command -v aws &> /dev/null; then
  echo "❌ Error: AWS CLI is not installed or not in PATH."
  echo "   Install from https://aws.amazon.com/cli/"
  exit 1
fi

if [ ! -d "${SOURCE_DIR}" ]; then
  echo "❌ Error: Source directory '${SOURCE_DIR}' does not exist."
  echo "   Run this script from the repository root."
  exit 1
fi

if ! aws s3 ls "s3://${BUCKET_NAME}" \
    --region "${REGION}" \
    --profile "${AWS_PROFILE}" &> /dev/null; then
  echo "❌ Error: Cannot access s3://${BUCKET_NAME}."
  echo "   - Check that the bucket exists in ${REGION}"
  echo "   - Verify your AWS credentials have s3:PutObject, s3:DeleteObject, s3:ListBucket permissions"
  exit 1
fi

echo "✅ Pre-flight checks passed."
echo

# ============================================
# EXECUTE SYNC
# ============================================
SYNC_CMD=(
  aws s3 sync "${SOURCE_DIR}" "s3://${BUCKET_NAME}"
  --region "${REGION}"
  --profile "${AWS_PROFILE}"
  --delete
  --cache-control "${CACHE_CONTROL}"
  --exclude "*.sh"
  --exclude "*.bat"
  --exclude "*.ps1"
  --exclude "*.md"
  --exclude ".DS_Store"
  --exclude "*.git*"
  --exclude "node_modules/*"
  --exclude "temp-*"
  --exclude "usage-example*"
)

if [ "$DRY_RUN" = true ]; then
  SYNC_CMD+=(--dryrun)
  echo "🔍 DRY RUN — No changes will be made"
  echo
fi

echo "Syncing files..."
echo "Command: ${SYNC_CMD[*]}"
echo

"${SYNC_CMD[@]}"

echo
echo "✅ Sync complete."

# ============================================
# OPTIONAL CLOUDFRONT INVALIDATION
# ============================================
if [ "$INVALIDATE" = true ] && [ -n "${CLOUDFRONT_DISTRIBUTION_ID}" ]; then
  echo
  echo "🔄 Creating CloudFront invalidation for path '/*'..."
  aws cloudfront create-invalidation \
    --distribution-id "${CLOUDFRONT_DISTRIBUTION_ID}" \
    --paths "/*" \
    --profile "${AWS_PROFILE}" \
    --output text \
    --query 'Invalidation.Id'
  echo "✅ Invalidation requested."
elif [ "$INVALIDATE" = true ]; then
  echo
  echo "⚠️  --invalidate was passed but CLOUDFRONT_DISTRIBUTION_ID is not set."
  echo "   Export CLOUDFRONT_DISTRIBUTION_ID or set it in this script."
fi

echo
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Deployment finished successfully."
echo
echo "Next steps:"
echo "   • Create a CloudFront distribution pointing at this bucket (if not done)"
echo "   • Run with --invalidate after updating CLOUDFRONT_DISTRIBUTION_ID"
echo "   • To preview changes without uploading: ./deploy.sh --dry-run"

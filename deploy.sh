#!/usr/bin/env bash
#
# deploy.sh
# FlopSource — Production Frontend Deployment
#
# Syncs the static corporate directory to AWS S3 for hosting.
# Designed for use by infrastructure / DevOps teams.
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
BUCKET_NAME="8bitcommons--usw2-az1--x-s3"
# NOTE: This is the legacy bucket name. We are keeping it for now.
# No migration to a FlopSource-named bucket will occur until the Directory is mature.

# This is an S3 Express One Zone Directory Bucket (us-west-2, AZ1)
REGION="us-west-2"
ENDPOINT_URL="https://s3express-usw2-az1.us-west-2.amazonaws.com"

SOURCE_DIR="website"
AWS_PROFILE="${AWS_PROFILE:-default}"
CACHE_CONTROL="public, max-age=31536000, immutable"   # 1 year for static assets (adjust if needed)

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

# Verify bucket exists and we have access (S3 Express One Zone)
if ! aws s3 ls "s3://${BUCKET_NAME}" \
    --region "${REGION}" \
    --endpoint-url "${ENDPOINT_URL}" \
    --profile "${AWS_PROFILE}" &> /dev/null; then
  echo "❌ Error: Cannot access s3://${BUCKET_NAME}."
  echo "   - This is an S3 Express One Zone Directory Bucket"
  echo "   - Check that the bucket exists in us-west-2 (AZ1)"
  echo "   - Verify your AWS credentials have s3express:CreateSession + s3:PutObject permissions"
  echo "   - Note: S3 Express buckets do NOT support traditional Static Website Hosting"
  exit 1
fi

echo "✅ Pre-flight checks passed."
echo

# ============================================
# EXECUTE SYNC (S3 Express One Zone)
# ============================================
SYNC_CMD=(
  aws s3 sync "${SOURCE_DIR}" "s3://${BUCKET_NAME}"
  --region "${REGION}"
  --endpoint-url "${ENDPOINT_URL}"
  --profile "${AWS_PROFILE}"
  --delete
  --cache-control "${CACHE_CONTROL}"
  --exclude "*.sh"
  --exclude ".DS_Store"
  --exclude "*.git*"
  --exclude "node_modules/*"
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
echo "⚠️  IMPORTANT (S3 Express One Zone):"
echo "   This bucket type does NOT support S3 Static Website Hosting."
echo "   You cannot use the traditional s3-website endpoint."
echo
echo "Recommended production architecture:"
echo "   1. Keep assets in this S3 Express bucket (high performance)"
echo "   2. Front it with CloudFront using the S3 Express bucket as origin"
echo "   3. Use CloudFront Functions or OAC for proper content-type handling"
echo
echo "Next steps:"
echo "   • Test by accessing objects directly via the S3 Express endpoint"
echo "   • Create a CloudFront distribution pointing at this bucket"
echo "   • If using CloudFront, run with --invalidate after updating CLOUDFRONT_DISTRIBUTION_ID"
echo
echo "To preview changes without uploading: ./deploy.sh --dry-run"
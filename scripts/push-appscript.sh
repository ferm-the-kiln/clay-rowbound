#!/usr/bin/env bash
set -e

MARKETPLACE_DEPLOYMENT_ID="AKfycbzV6-DUiSWzqRzqmL4_rDCxFreZIB8ehh9k3sUiUWmwxCl8keMo01ZqN0-BulxNAe0Vdg"
GCP_SDK_URL="https://console.cloud.google.com/apis/api/appsmarket-component.googleapis.com/googleapps_sdk?project=rowbound"

echo "→ Pushing files..."
cd "$(dirname "$0")/../apps-script"
clasp push --force

echo "→ Creating new version..."
VERSION=$(clasp version "Deploy $(date '+%Y-%m-%d %H:%M')" | grep -o '[0-9]*$')
echo "  Version $VERSION created"

echo "→ Updating Marketplace deployment..."
clasp deploy --deploymentId "$MARKETPLACE_DEPLOYMENT_ID" --versionNumber "$VERSION" --description "Deploy v$VERSION"

echo ""
echo "✓ Code deployed to version $VERSION"
echo ""
echo "┌─────────────────────────────────────────────────────────────┐"
echo "│ MANUAL STEP REQUIRED (10 seconds):                          │"
echo "│                                                             │"
echo "│  1. Open: $GCP_SDK_URL"
echo "│  2. Set 'Sheets add-on script version' to: $VERSION         │"
echo "│  3. Click 'Save Draft'                                      │"
echo "│                                                             │"
echo "│  (GCP Marketplace SDK has no public API for this field)     │"
echo "└─────────────────────────────────────────────────────────────┘"
open "$GCP_SDK_URL" 2>/dev/null || true

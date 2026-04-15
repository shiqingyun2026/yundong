#!/usr/bin/env bash

set -euo pipefail

# Usage:
# 1. Copy this file to set-cloudflare-secrets.sh
# 2. Replace every TODO_* value with the real secret
# 3. Run it from /Users/yun/lindong/backend

put_secret() {
  local key="$1"
  local value="$2"
  printf '%s' "$value" | npx wrangler secret put "$key"
}

put_secret "SUPABASE_URL" "TODO_SUPABASE_URL"
put_secret "SUPABASE_SERVICE_ROLE_KEY" "TODO_SUPABASE_SERVICE_ROLE_KEY"
put_secret "JWT_SECRET" "TODO_JWT_SECRET"
put_secret "WX_MINIPROGRAM_APP_SECRET" "TODO_WX_MINIPROGRAM_APP_SECRET"
put_secret "WX_PAY_MCH_ID" "TODO_WX_PAY_MCH_ID"
put_secret "WX_PAY_MCH_SERIAL_NO" "TODO_WX_PAY_MCH_SERIAL_NO"
put_secret "WX_PAY_PRIVATE_KEY" $'-----BEGIN PRIVATE KEY-----\nTODO_WX_PAY_PRIVATE_KEY\n-----END PRIVATE KEY-----\n'
put_secret "WX_PAY_PLATFORM_CERT" $'-----BEGIN CERTIFICATE-----\nTODO_WX_PAY_PLATFORM_CERT\n-----END CERTIFICATE-----\n'
put_secret "WX_PAY_API_V3_KEY" "TODO_WX_PAY_API_V3_KEY"
put_secret "WX_GROUP_RESULT_TEMPLATE_FIELD_MAP" '{"title":"thing1","resultText":"thing2","actionText":"thing3","courseStartTime":"time4","courseAddress":"thing5"}'

echo "Cloudflare secrets template applied."

#!/usr/bin/env bash
# =============================================================================
# Supabase Inactivity Keepalive Ping Script for ITIMS
# Prevents Supabase Free Tier projects from pausing due to 7-day inactivity.
# =============================================================================

set -uo pipefail

LOG_FILE="/var/log/supabase-keepalive.log"
USER_LOG="$HOME/supabase-keepalive.log"
ENV_FILE="${ENV_FILE:-/home/ubuntu/itims/backend/.env}"
INTERVAL_SECONDS=561600 # 6 days and 12 hours (156 hours)
STATE_FILE="$HOME/.supabase_keepalive_last_run"

log() {
    local msg="[$(date -u '+%Y-%m-%d %H:%M:%S UTC')] $1"
    echo "$msg"
    echo "$msg" >> "$USER_LOG" 2>/dev/null || true
    if [ -w "$LOG_FILE" ] || [ "$(id -u)" -eq 0 ]; then
        echo "$msg" >> "$LOG_FILE" 2>/dev/null || true
    fi
}

# Check if run with --force or interval check
FORCE=false
if [[ "${1:-}" == "--force" ]] || [[ "${1:-}" == "-f" ]]; then
    FORCE=true
fi

now=$(date +%s)
if [ "$FORCE" = false ] && [ -f "$STATE_FILE" ]; then
    last_run=$(cat "$STATE_FILE" 2>/dev/null || echo 0)
    elapsed=$(( now - last_run ))
    if [ "$elapsed" -lt "$INTERVAL_SECONDS" ]; then
        remaining=$(( INTERVAL_SECONDS - elapsed ))
        log "[SKIP] Last ping was $elapsed seconds ago. Next ping in $(( remaining / 3600 ))h $(( (remaining % 3600) / 60 ))m. Use --force to override."
        exit 0
    fi
fi

# Load Supabase configuration
if [ -f "$ENV_FILE" ]; then
    SUPABASE_URL=$(grep -E '^SUPABASE_URL=' "$ENV_FILE" | head -n 1 | cut -d '=' -f2- | tr -d ' "\r\n')
    SUPABASE_KEY=$(grep -E '^(SUPABASE_ANON_KEY|SUPABASE_SERVICE_KEY)=' "$ENV_FILE" | head -n 1 | cut -d '=' -f2- | tr -d ' "\r\n')
else
    SUPABASE_URL="${SUPABASE_URL:-}"
    SUPABASE_KEY="${SUPABASE_ANON_KEY:-${SUPABASE_SERVICE_KEY:-}}"
fi

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_KEY" ]; then
    log "[ERROR] SUPABASE_URL or API key not found in $ENV_FILE or environment!"
    exit 1
fi

log "[INFO] Initiating keepalive ping to $SUPABASE_URL..."

# Retry loop (up to 3 attempts)
SUCCESS=false
for attempt in 1 2 3; do
    log "[PING] Attempt $attempt/3: Querying Supabase PostgREST API..."
    
    RESPONSE=$(curl -s -o /dev/null -w "%{http_code}:%{time_total}s" \
        --connect-timeout 10 \
        --max-time 20 \
        -H "apikey: $SUPABASE_KEY" \
        -H "Authorization: Bearer $SUPABASE_KEY" \
        -H "User-Agent: ITIMS-Keepalive-Bot/1.0" \
        "${SUPABASE_URL}/rest/v1/departments?select=id&limit=1" 2>&1 || echo "000:0.0s")
    
    HTTP_CODE=$(echo "$RESPONSE" | cut -d ':' -f1)
    LATENCY=$(echo "$RESPONSE" | cut -d ':' -f2)

    if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 400 ]; then
        log "[SUCCESS] Supabase PostgREST responded with HTTP $HTTP_CODE in $LATENCY. Activity recorded successfully!"
        SUCCESS=true
        break
    else
        log "[WARN] Ping attempt $attempt received HTTP $HTTP_CODE (Latency: $LATENCY). Retrying in 10s..."
        sleep 10
    fi
done

if [ "$SUCCESS" = true ]; then
    # Secondary ping to Auth Gateway to ensure both Database and Auth are stimulated
    AUTH_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
        --connect-timeout 8 \
        --max-time 15 \
        -H "apikey: $SUPABASE_KEY" \
        -H "User-Agent: ITIMS-Keepalive-Bot/1.0" \
        "${SUPABASE_URL}/auth/v1/settings" 2>&1 || echo "000")
    log "[SUCCESS] Supabase Auth Gateway responded with HTTP $AUTH_CODE."
    
    echo "$now" > "$STATE_FILE"
    log "[DONE] Keepalive cycle completed. Next scheduled run in 6 days 12 hours (156 hours)."
    exit 0
else
    log "[ERROR] All 3 keepalive ping attempts failed! Please check Supabase project status."
    exit 2
fi

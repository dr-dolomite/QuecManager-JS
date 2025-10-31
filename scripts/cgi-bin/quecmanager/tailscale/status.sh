#!/bin/sh

# Tailscale Status Checker
# Checks if luci-app-tailscale is installed and running

echo "Content-type: application/json"
echo ""

# Check if luci-app-tailscale package is installed
check_installed() {
    opkg list-installed | grep -q "luci-app-tailscale"
    return $?
}

# Check if tailscale service is running
check_running() {
    # Check via /etc/init.d script
    if [ -f /etc/init.d/tailscale ]; then
        /etc/init.d/tailscale status >/dev/null 2>&1
        return $?
    fi

    return 1
}
# Check authentication status and get login URL if needed
check_authentication() {
    if ! command -v tailscale >/dev/null 2>&1; then
        return 1
    fi

    # Run tailscale status and capture output
    local ts_status=$(tailscale status 2>&1)

    # Check for NoState - indicates no internet connectivity
    if echo "$ts_status" | grep -qi "unexpected state: NoState"; then
        # Return 3 to indicate no internet connectivity
        return 3
    fi

    # Check for DNS resolution failures (no internet)
    if echo "$ts_status" | grep -qi "failed to resolve\|no DNS fallback"; then
        # Return 3 to indicate no internet connectivity
        return 3
    fi

    # Check if logged out
    if echo "$ts_status" | grep -q "Logged out"; then
        # Extract login URL using grep and awk
        local login_url=$(echo "$ts_status" | grep "Log in at:" | awk '{print $NF}')

        if [ -n "$login_url" ]; then
            # Return 2 to indicate not authenticated with URL
            echo "$login_url"
            return 2
        else
            # Logged out but no URL in status output
            # Run tailscale login to generate authentication URL
            local temp_file="/tmp/tailscale_login_$$.txt"

            # Kill any existing tailscale login processes to avoid conflicts
            pkill -f "tailscale login" 2>/dev/null

            # Run tailscale login in background and capture output
            timeout 10 tailscale login > "$temp_file" 2>&1 &
            local login_pid=$!

            # Wait a moment for the login command to generate the URL
            sleep 2

            # Extract URL from temp file
            if [ -f "$temp_file" ]; then
                login_url=$(grep -o 'https://login\.tailscale\.com/[^[:space:]]*' "$temp_file" | head -1)

                # Clean up temp file
                rm -f "$temp_file"

                # Kill the background tailscale login process
                kill $login_pid 2>/dev/null

                if [ -n "$login_url" ]; then
                    echo "$login_url"
                    return 2
                fi
            fi

            # Still no URL found
            return 1
        fi
    fi

    # Check if there's any actual status output (authenticated)
    if [ -n "$ts_status" ] && ! echo "$ts_status" | grep -q "Logged out"; then
        # Authenticated - has peers or at least shows status
        return 0
    fi

    # Unknown state
    return 1
}

# Main logic
if check_installed; then
    # Package is installed, check if running
    if check_running; then
        # Service is running, check authentication
        auth_url=$(check_authentication)
        auth_status=$?
        service_status=$(/etc/init.d/tailscale status)
        # Debug: Log to stderr (will appear in web server error log)
        echo "DEBUG: auth_status=$auth_status, auth_url='$auth_url'" >&2

        if [ $auth_status -eq 0 ] && [ "$service_status" == 'running' ]; then
            # State 1: Installed, running, and authenticated
            echo '{"status":"success","installed":true,"running":true,"authenticated":true,"message":"Tailscale is installed, running, and authenticated"}'
        elif [ $auth_status -eq 0 ] && [ "$service_status" == 'active with no instances' ]; then
            # State 5: Installed, running, but authentication status unknown
            echo '{"status":"success","installed":true,"running":false,"authenticated":false,"message":"Tailscaled is not running"}'
        elif [ $auth_status -eq 2 ]; then
            # State 4: Installed, running, but not authenticated (has login URL)
            echo "{\"status\":\"success\",\"installed\":true,\"running\":true,\"authenticated\":false,\"login_url\":\"$auth_url\",\"message\":\"Tailscale is running but not authenticated\"}"
        elif [ $auth_status -eq 3 ]; then
            # State 6: Installed, running, but no internet connectivity
            echo '{"status":"error","error":"no_internet","message":"Device has no internet connection. Tailscale requires internet access to authenticate and connect.","installed":true,"running":true,"authenticated":false}'
        else
            # State 5: Installed, running, but authentication status unknown
            echo '{"status":"success","installed":true,"running":true,"authenticated":false,"message":"Tailscale is running but authentication status is unknown"}'
        fi
    else
        # State 2: Installed but not running
        echo '{"status":"success","installed":true,"running":false,"authenticated":false,"message":"Tailscale is installed but inactive"}'
    fi
else
    # State 3: Not installed
    echo '{"status":"success","installed":false,"running":false,"authenticated":false,"message":"luci-app-tailscale is not installed"}'
fi
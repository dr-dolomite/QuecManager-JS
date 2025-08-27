#!/bin/sh

# Ultra-Simple Profile Picture Management Script
# Handles direct file uploads without base64 encoding
# Author: dr-dolomite
# Date: 2025-08-04

# Set content type and CORS headers
echo "Content-Type: application/json"
echo "Access-Control-Allow-Origin: *"
echo "Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS"
echo "Access-Control-Allow-Headers: Content-Type, Authorization"
echo ""

# Configuration
PROFILE_DIR="/www/assets/profile"
PROFILE_IMAGE="$PROFILE_DIR/profile.jpg"
TEMP_DIR="/tmp"
LOG_FILE="/tmp/profile_picture.log"

# Logging function
log_message() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" >> "$LOG_FILE"
}

# Error response function
send_error() {
    local error_code="$1"
    local error_message="$2"
    log_message "ERROR: $error_message"
    echo "{\"status\":\"error\",\"code\":\"$error_code\",\"message\":\"$error_message\"}"
    exit 1
}

# Success response function
send_success() {
    local message="$1"
    local data="$2"
    log_message "SUCCESS: $message"
    if [ -n "$data" ]; then
        echo "{\"status\":\"success\",\"message\":\"$message\",\"data\":$data}"
    else
        echo "{\"status\":\"success\",\"message\":\"$message\"}"
    fi
}

# Get file size
get_file_size() {
    local file="$1"
    if [ -f "$file" ]; then
        stat -c%s "$file" 2>/dev/null || wc -c < "$file"
    else
        echo 0
    fi
}

# Create profile directory if it doesn't exist
ensure_profile_directory() {
    if [ ! -d "$PROFILE_DIR" ]; then
        mkdir -p "$PROFILE_DIR"
        if [ $? -ne 0 ]; then
            send_error "DIRECTORY_ERROR" "Failed to create profile directory"
        fi
        chmod 755 "$PROFILE_DIR"
        log_message "Created profile directory: $PROFILE_DIR"
    fi
}

# Handle GET request - Fetch profile picture
handle_get() {
    log_message "GET request received"
    
    if [ -f "$PROFILE_IMAGE" ]; then
        # Get file information
        local file_size=$(get_file_size "$PROFILE_IMAGE")
        local file_modified=$(stat -c %Y "$PROFILE_IMAGE" 2>/dev/null || echo "0")
        
        # Return file information and base64 encoded image
        local base64_image=""
        if command -v base64 >/dev/null 2>&1; then
            base64_image=$(base64 -w 0 "$PROFILE_IMAGE" 2>/dev/null)
        elif command -v openssl >/dev/null 2>&1; then
            base64_image=$(openssl base64 -in "$PROFILE_IMAGE" | tr -d '\n' 2>/dev/null)
        elif command -v python3 >/dev/null 2>&1; then
            base64_image=$(python3 -c "
import base64
try:
    with open('$PROFILE_IMAGE', 'rb') as f:
        data = f.read()
        encoded = base64.b64encode(data).decode('ascii')
        print(encoded)
except Exception as e:
    pass
" 2>/dev/null)
        elif command -v busybox >/dev/null 2>&1; then
            base64_image=$(busybox base64 "$PROFILE_IMAGE" | tr -d '\n' 2>/dev/null)
        fi
        
        if [ -n "$base64_image" ]; then
            local file_type=$(file -b --mime-type "$PROFILE_IMAGE" 2>/dev/null || echo "image/jpeg")
            send_success "Profile picture found" "{\"exists\":true,\"size\":$file_size,\"modified\":$file_modified,\"type\":\"$file_type\",\"data\":\"data:$file_type;base64,$base64_image\"}"
        else
            send_success "Profile picture found but could not encode" "{\"exists\":true,\"size\":$file_size,\"modified\":$file_modified,\"data\":null}"
        fi
    else
        log_message "No profile picture found"
        echo "{\"status\":\"error\",\"code\":\"NO_IMAGE_FOUND\",\"message\":\"No profile picture found\"}"
    fi
}

# Handle POST request - Direct file upload (no base64)
handle_post() {
    log_message "POST request received"
    ensure_profile_directory
    
    # Create temporary file with unique name
    local temp_file="$TEMP_DIR/profile_upload_$$"
    
    log_message "Content-Type: ${CONTENT_TYPE:-unknown}"
    log_message "Content-Length: ${CONTENT_LENGTH:-unknown}"
    
    # Read the raw uploaded file data directly to temp file
    cat > "$temp_file"
    
    # Check if file was created and has content
    if [ ! -f "$temp_file" ]; then
        send_error "UPLOAD_ERROR" "Failed to receive uploaded file"
    fi
    
    local temp_size=$(get_file_size "$temp_file")
    log_message "Received file size: $temp_size bytes"
    
    if [ "$temp_size" -eq 0 ]; then
        rm -f "$temp_file"
        send_error "UPLOAD_ERROR" "Received empty file"
    fi
    
    # Simply move the uploaded file to profile location (rename operation)
    if mv "$temp_file" "$PROFILE_IMAGE"; then
        chmod 644 "$PROFILE_IMAGE"
        local file_size=$(get_file_size "$PROFILE_IMAGE")
        log_message "Profile picture saved successfully, size: $file_size bytes"
        send_success "Profile picture uploaded successfully" "{\"size\":$file_size,\"path\":\"$PROFILE_IMAGE\"}"
    else
        rm -f "$temp_file"
        send_error "SAVE_ERROR" "Failed to save profile picture"
    fi
}

# Handle DELETE request - Remove profile picture
handle_delete() {
    log_message "DELETE request received"
    
    if [ -f "$PROFILE_IMAGE" ]; then
        if rm "$PROFILE_IMAGE"; then
            send_success "Profile picture deleted successfully"
        else
            send_error "DELETE_ERROR" "Failed to delete profile picture"
        fi
    else
        send_error "NO_IMAGE_FOUND" "No profile picture found to delete"
    fi
}

# Handle OPTIONS request for CORS preflight
handle_options() {
    echo "Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS"
    echo "Access-Control-Allow-Headers: Content-Type, Authorization"
    echo "Access-Control-Max-Age: 86400"
    exit 0
}

# Main execution
log_message "Profile picture script called with method: ${REQUEST_METHOD:-GET}"

# Handle different HTTP methods
case "${REQUEST_METHOD:-GET}" in
    GET)
        handle_get
        ;;
    POST)
        handle_post
        ;;
    DELETE)
        handle_delete
        ;;
    OPTIONS)
        handle_options
        ;;
    *)
        send_error "METHOD_NOT_ALLOWED" "HTTP method ${REQUEST_METHOD} not supported"
        ;;
esac

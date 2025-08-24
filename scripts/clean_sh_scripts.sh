#!/bin/bash

# Script to clean Windows line endings (^M or \r) from shell scripts
# Processes all .sh files in 3 specified folders and their subfolders

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to clean a single file
clean_file() {
    local file="$1"
    
    # Check if file contains Windows line endings
    if grep -q $'\r' "$file"; then
        print_status "Cleaning: $file"
        
        # Try dos2unix first (if available)
        if command -v dos2unix > /dev/null 2>&1; then
            dos2unix "$file" 2>/dev/null
        else
            # Fallback to sed
            sed -i 's/\r$//' "$file"
        fi
        
        # Verify the file was cleaned
        if ! grep -q $'\r' "$file"; then
            print_success "✓ Cleaned: $file"
            return 0
        else
            print_error "✗ Failed to clean: $file"
            return 1
        fi
    fi
    return 0
}

# Function to process a directory
process_directory() {
    local dir="$1"
    local processed=0
    local cleaned=0
    
    if [[ ! -d "$dir" ]]; then
        print_warning "Directory not found: $dir"
        return 1
    fi
    
    print_status "Processing directory: $dir"
    
    # Find all .sh files recursively
    while IFS= read -r -d '' file; do
        ((processed++))
        if clean_file "$file"; then
            if grep -q $'\r' "$file" 2>/dev/null; then
                # File had Windows endings and was processed
                ((cleaned++))
            fi
        fi
    done < <(find "$dir" -type f -name "*.sh" -print0)
    
    print_status "Processed $processed .sh files in $dir"
    return 0
}

# Main execution
main() {
    print_status "Starting shell script cleanup process..."
    print_status "Looking for Windows line endings (^M or \\r) in .sh files..."
    echo
    
    # Check if we have the necessary tools
    if ! command -v dos2unix > /dev/null 2>&1; then
        print_warning "dos2unix not found, using sed as fallback"
    fi
    
    # Define the 3 folders to process (modify these as needed)
    # You can change these folder names to match your actual directories
    folders=("folder1" "folder2" "folder3")
    
    # Check if user wants to specify different folder names
    if [[ $# -eq 3 ]]; then
        folders=("$1" "$2" "$3")
        print_status "Using custom folders: ${folders[*]}"
    elif [[ $# -gt 0 && $# -ne 3 ]]; then
        print_error "Usage: $0 [folder1] [folder2] [folder3]"
        print_error "Either provide no arguments (uses default: folder1, folder2, folder3)"
        print_error "Or provide exactly 3 folder names"
        exit 1
    else
        print_status "Using default folders: ${folders[*]}"
        print_warning "To specify different folders, run: $0 <folder1> <folder2> <folder3>"
    fi
    
    echo
    
    # Process each folder
    total_dirs=0
    successful_dirs=0
    
    for folder in "${folders[@]}"; do
        ((total_dirs++))
        if process_directory "$folder"; then
            ((successful_dirs++))
        fi
        echo
    done
    
    # Summary
    echo "==============================================="
    print_status "Cleanup completed!"
    print_status "Processed $successful_dirs out of $total_dirs directories"
    
    if [[ $successful_dirs -eq $total_dirs ]]; then
        print_success "All directories processed successfully!"
    else
        print_warning "Some directories could not be processed"
    fi
    echo "==============================================="
}

# Run main function with all arguments
main "$@"
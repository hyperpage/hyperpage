#!/bin/bash
# Simple script to convert relative imports to path aliases

set -e

echo "🔧 Starting simple relative import conversion..."

# Create a backup
BACKUP_DIR="backup-$(date +%Y%m%d-%H%M%S)"
echo "Creating backup in $BACKUP_DIR..."
mkdir -p "$BACKUP_DIR"
rsync -av --exclude=node_modules/ --exclude=.git/ --exclude="backup-*/" --exclude=scripts/ . "$BACKUP_DIR/"

# Counter for changes
CHANGES_MADE=0

# Function to convert relative imports in a single file
convert_file_imports() {
    local file="$1"
    local changes_in_file=0

    # Skip test files and scripts
    if [[ "$file" =~ \.(test|spec)\.(ts|tsx|js|jsx)$ ]] || [[ "$file" =~ ^scripts/ ]]; then
        return 0
    fi

    # Convert relative imports (../) to path aliases
    # Handle both named and default imports
    if grep -q "from ['\"]\.\." "$file"; then
        # For files in app/ directory
        if [[ "$file" =~ ^app/ ]]; then
            # Convert ../../ to @/lib/
            sed -i.tmp 's|from ["'"'"']\.\.\.\.|from "@/lib/|g' "$file"
            sed -i.tmp 's|from ["'"'"']\.\.\/|from "@/lib/|g' "$file"
            sed -i.tmp 's|from ["'"'"']\.\./|from "@/lib/|g' "$file"
            changes_in_file=$(grep -c "from \"@/lib" "$file" || echo 0)
        # For files in lib/ directory  
        elif [[ "$file" =~ ^lib/ ]]; then
            sed -i.tmp 's|from ["'"'"']\.\.\/|from "@/lib/|g' "$file"
            sed -i.tmp 's|from ["'"'"']\.\./|from "@/lib/|g' "$file"
            changes_in_file=$(grep -c "from \"@/lib" "$file" || echo 0)
        # For files in components/ directory
        elif [[ "$file" =~ ^components/ ]]; then
            sed -i.tmp 's|from ["'"'"']\.\.\/|from "@/components/|g' "$file"
            sed -i.tmp 's|from ["'"'"']\.\./|from "@/components/|g' "$file"
            changes_in_file=$(grep -c "from \"@/components" "$file" || echo 0)
        # For files in tools/ directory
        elif [[ "$file" =~ ^tools/ ]]; then
            sed -i.tmp 's|from ["'"'"']\.\.\/|from "@/tools/|g' "$file"
            sed -i.tmp 's|from ["'"'"']\.\./|from "@/tools/|g' "$file"
            changes_in_file=$(grep -c "from \"@/tools" "$file" || echo 0)
        fi
    fi

    # Convert same directory imports (./) to path aliases
    if grep -q "from ['\"]\.\/" "$file"; then
        if [[ "$file" =~ ^app/ ]]; then
            sed -i.tmp 's|from ["'"'"']\./|from "@/app/|g' "$file"
            changes_in_file=$((changes_in_file + $(grep -c "from \"@/app" "$file" || echo 0)))
        elif [[ "$file" =~ ^lib/ ]]; then
            sed -i.tmp 's|from ["'"'"']\./|from "@/lib/|g' "$file"
            changes_in_file=$((changes_in_file + $(grep -c "from \"@/lib" "$file" || echo 0)))
        elif [[ "$file" =~ ^components/ ]]; then
            sed -i.tmp 's|from ["'"'"']\./|from "@/components/|g' "$file"
            changes_in_file=$((changes_in_file + $(grep -c "from \"@/components" "$file" || echo 0)))
        elif [[ "$file" =~ ^tools/ ]]; then
            sed -i.tmp 's|from ["'"'"']\./|from "@/tools/|g' "$file"
            changes_in_file=$((changes_in_file + $(grep -c "from \"@/tools" "$file" || echo 0)))
        fi
    fi

    # Clean up temp file
    if [ -f "${file}.tmp" ]; then
        rm "${file}.tmp"
    fi

    if [ $changes_in_file -gt 0 ]; then
        CHANGES_MADE=$((CHANGES_MADE + changes_in_file))
        echo "✅ Converted $changes_in_file imports in $file"
    fi
}

# Find and process all TypeScript/JavaScript files, excluding scripts
echo "Processing all TypeScript and JavaScript files..."
find . -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" | \
    grep -v node_modules | \
    grep -v "\.next" | \
    grep -v "backup-" | \
    grep -v "^./scripts/" | \
    while read -r file; do
        convert_file_imports "$file"
    done

echo "📊 Conversion complete!"
echo "Total changes made: $CHANGES_MADE"

# Test the changes
echo "Testing TypeScript compilation..."
if npx tsc --noEmit; then
    echo "✅ TypeScript compilation successful after import conversion"
    echo "🎉 All relative imports have been successfully converted to path aliases!"
    echo "Backup created in: $BACKUP_DIR"
else
    echo "❌ TypeScript compilation failed. Check changes."
    echo "You can restore from backup: $BACKUP_DIR"
    exit 1
fi

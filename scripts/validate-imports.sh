#!/bin/bash
# Comprehensive import validation script

set -e

echo "🔍 Starting comprehensive import validation..."

# Counter for issues found
ISSUES_FOUND=0

# 1. Check for any remaining relative imports
echo "Checking for relative imports..."
RELATIVE_IMPORTS=$(find . -name "*.ts" -o -name "*.tsx" | grep -v -E "node_modules|\.next" | xargs grep -l "import.*\.\.\/" | wc -l)
if [ $RELATIVE_IMPORTS -gt 0 ]; then
  echo "❌ Found $RELATIVE_IMPORTS files with relative imports"
  find . -name "*.ts" -o -name "*.tsx" | grep -v -E "node_modules|\.next" | xargs grep -l "import.*\.\.\/" | head -10
  ISSUES_FOUND=$((ISSUES_FOUND + RELATIVE_IMPORTS))
else
  echo "✅ No relative imports found in source code"
fi

# 2. Verify all files use standardized import patterns for internal imports
echo "Checking import pattern compliance..."
echo "Finding files with internal imports that don't use path aliases..."

# Create a temporary file to store problematic files
TEMP_FILE=$(mktemp)

# Find files that have internal imports but don't use path aliases
find . -name "*.ts" -o -name "*.tsx" | grep -v -E "node_modules|\.next" | while read -r file; do
  # Check if file has any imports
  if grep -q "import" "$file"; then
    # Check if file has internal imports (from lib/, app/, components/, tools/)
    if grep -q "from ['\"]\.\.\|from ['\"]\.\/\|from ['\"]lib\|from ['\"]app\|from ['\"]components\|from ['\"]tools" "$file"; then
      # Check if file uses path aliases
      if ! grep -q "@/lib\|@/components\|@/tools\|@/app" "$file"; then
        echo "$file" >> "$TEMP_FILE"
      fi
    fi
  fi
done

NON_STANDARD_IMPORTS=$(wc -l < "$TEMP_FILE")
if [ $NON_STANDARD_IMPORTS -gt 0 ]; then
  echo "❌ Found $NON_STANDARD_IMPORTS files not using standard import patterns"
  head -10 "$TEMP_FILE"
  ISSUES_FOUND=$((ISSUES_FOUND + NON_STANDARD_IMPORTS))
else
  echo "✅ All files using standard import patterns"
fi

# Clean up temp file
rm -f "$TEMP_FILE"

# 3. Check TypeScript compilation
echo "Running TypeScript compilation..."
if npx tsc --noEmit; then
  echo "✅ TypeScript compilation successful"
else
  echo "❌ TypeScript compilation failed"
  ISSUES_FOUND=$((ISSUES_FOUND + 1))
fi

# 4. Check ESLint compliance
echo "Running ESLint validation..."
if npx eslint . --ext .ts,.tsx --max-warnings 0; then
  echo "✅ ESLint validation passed"
else
  echo "❌ ESLint validation failed"
  ISSUES_FOUND=$((ISSUES_FOUND + 1))
fi

# 5. Verify barrel exports
echo "Verifying barrel exports..."
MISSING_EXPORTS=0
for module in "lib" "tools" "components"; do
  if [ ! -f "${module}/index.ts" ]; then
    echo "❌ Missing barrel export: ${module}/index.ts"
    MISSING_EXPORTS=$((MISSING_EXPORTS + 1))
  fi
done
if [ $MISSING_EXPORTS -eq 0 ]; then
  echo "✅ All barrel exports present"
fi

# Final result
if [ $ISSUES_FOUND -eq 0 ]; then
  echo "🎉 Import validation completed successfully!"
  echo "All files are using standardized import patterns."
  exit 0
else
  echo "❌ Import validation failed with $ISSUES_FOUND issues found"
  exit 1
fi

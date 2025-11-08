#!/bin/bash
# Check component size compliance

echo "Checking component size compliance..."

# Find all component files
COMPONENTS=$(find app/components -name "*.tsx" -type f)

OVERSIZE_COMPONENTS=0
for component in $COMPONENTS; do
  line_count=$(wc -l < "$component")
  if [ $line_count -gt 100 ]; then
    echo "❌ Oversized component: $component ($line_count lines)"
    OVERSIZE_COMPONENTS=$((OVERSIZE_COMPONENTS + 1))
  fi
done

if [ $OVERSIZE_COMPONENTS -eq 0 ]; then
  echo "✅ All components within size limit (100 lines)"
else
  echo "❌ Found $OVERSIZE_COMPONENTS oversized components"
  exit 1
fi

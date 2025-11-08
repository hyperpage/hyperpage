#!/bin/bash
# bundle-analysis.sh

echo "🔍 Starting Next.js bundle analysis..."

# Ensure bundle analyzer dependency is installed
echo "📦 Checking bundle analyzer dependency..."
if ! npm list @next/bundle-analyzer >/dev/null 2>&1; then
  echo "Installing @next/bundle-analyzer..."
  npm install --save-dev @next/bundle-analyzer
fi

# Clean previous build artifacts
echo "🧹 Cleaning previous build..."
rm -rf .next

# Run build with bundle analysis enabled
echo "🔨 Building project with bundle analysis..."
ANALYZE=true npm run build

# Check if bundle analysis was successful
if [ -f ".next/analyze/bundle-analyzer.html" ]; then
  echo "✅ Bundle analysis completed successfully!"
  echo "📊 Bundle analyzer report generated at: .next/analyze/bundle-analyzer.html"
  echo "🌐 Open the HTML report in your browser to explore the bundle details"
else
  echo "⚠️  Bundle analyzer report not found. Trying alternative location..."
  # Check for alternative locations
  if [ -f "bundle-analyzer-report.html" ]; then
    echo "✅ Found report at: bundle-analyzer-report.html"
  else
    echo "❌ Bundle analysis may have failed. Check the build output above."
  fi
fi

# Show bundle size information
echo "📏 Bundle size information:"
if [ -d ".next/static" ]; then
  echo "📂 Static assets directory size:"
  du -sh .next/static/* 2>/dev/null || echo "No static assets found"
  
  echo "🏗️  Total build size:"
  du -sh .next 2>/dev/null || echo "Build directory not found"
fi

echo "🎉 Bundle analysis complete!"

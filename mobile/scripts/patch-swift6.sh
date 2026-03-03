#!/bin/bash
# =============================================================================
# patch-swift6.sh
# Fixes expo-modules-core Swift 6 incompatibility with Xcode 16.4+ (Swift 6.2)
#
# Problem: Xcode 16.4 ships Swift 6.2 which defaults to Swift 6 language mode.
# expo-modules-core@55.x uses `@MainActor` as a conformance attribute (SE-0434)
# in a way that breaks under Swift 5.9 language mode (set via Podfile).
#
# This script removes the `@MainActor` conformance attribute from two files
# in node_modules so the build succeeds.
#
# Run automatically via the "postinstall" hook in package.json.
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

FILE1="$PROJECT_DIR/node_modules/expo-modules-core/ios/Core/Views/SwiftUI/SwiftUIHostingView.swift"
FILE2="$PROJECT_DIR/node_modules/expo-modules-core/ios/Core/Views/ViewDefinition.swift"

PATCHED=0

# --- Patch 1: SwiftUIHostingView.swift ---
# Remove `@MainActor` from: ExpoView, @MainActor AnyExpoSwiftUIHostingView
if [ -f "$FILE1" ]; then
  if grep -q '@MainActor AnyExpoSwiftUIHostingView' "$FILE1"; then
    sed -i '' 's/ExpoView, @MainActor AnyExpoSwiftUIHostingView/ExpoView, AnyExpoSwiftUIHostingView/g' "$FILE1"
    echo "✅ Patched SwiftUIHostingView.swift (removed @MainActor conformance)"
    PATCHED=$((PATCHED + 1))
  else
    echo "ℹ️  SwiftUIHostingView.swift already patched or pattern not found"
  fi
else
  echo "⚠️  SwiftUIHostingView.swift not found — skipping"
fi

# --- Patch 2: ViewDefinition.swift ---
# Remove `@MainActor` from: extension UIView: @MainActor AnyArgument
if [ -f "$FILE2" ]; then
  if grep -q 'extension UIView: @MainActor AnyArgument' "$FILE2"; then
    sed -i '' 's/extension UIView: @MainActor AnyArgument/extension UIView: AnyArgument/g' "$FILE2"
    echo "✅ Patched ViewDefinition.swift (removed @MainActor conformance)"
    PATCHED=$((PATCHED + 1))
  else
    echo "ℹ️  ViewDefinition.swift already patched or pattern not found"
  fi
else
  echo "⚠️  ViewDefinition.swift not found — skipping"
fi

echo ""
if [ $PATCHED -gt 0 ]; then
  echo "🔧 Applied $PATCHED Swift 6 compatibility patch(es)"
else
  echo "👍 No patches needed — files already fixed or expo-modules-core updated"
fi

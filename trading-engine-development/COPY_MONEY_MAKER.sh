#!/bin/bash

# Money Maker Tab + AI Floating Scanner - Copy Script
# This script copies all necessary files to a target app

# Usage: ./COPY_MONEY_MAKER.sh /path/to/target-app

TARGET_APP="${1:-.}"

if [ "$TARGET_APP" = "." ] || [ -z "$TARGET_APP" ]; then
    echo "Usage: ./COPY_MONEY_MAKER.sh /path/to/target-app"
    echo "Example: ./COPY_MONEY_MAKER.sh ../my-trading-app"
    exit 1
fi

echo "═══════════════════════════════════════════════════════════════════"
echo "  Money Maker Tab + AI Floating Scanner - File Copy"
echo "═══════════════════════════════════════════════════════════════════"
echo ""
echo "Target App: $TARGET_APP"
echo ""

# Check if target exists
if [ ! -d "$TARGET_APP" ]; then
    echo "❌ Error: Target directory does not exist: $TARGET_APP"
    exit 1
fi

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p "$TARGET_APP/lib"
mkdir -p "$TARGET_APP/components/tabs"
mkdir -p "$TARGET_APP/components"

# Copy Library Files
echo "📋 Copying library files..."
if [ -f "lib/quantum-edge-engine.ts" ]; then
    cp lib/quantum-edge-engine.ts "$TARGET_APP/lib/"
    echo "  ✓ quantum-edge-engine.ts"
else
    echo "  ❌ quantum-edge-engine.ts not found"
fi

if [ -f "lib/ai-floating-scanner.ts" ]; then
    cp lib/ai-floating-scanner.ts "$TARGET_APP/lib/"
    echo "  ✓ ai-floating-scanner.ts"
else
    echo "  ❌ ai-floating-scanner.ts not found"
fi

# Copy Component Files
echo ""
echo "🎨 Copying component files..."
if [ -f "components/tabs/money-maker-tab.tsx" ]; then
    cp components/tabs/money-maker-tab.tsx "$TARGET_APP/components/tabs/"
    echo "  ✓ money-maker-tab.tsx"
else
    echo "  ❌ money-maker-tab.tsx not found"
fi

if [ -f "components/ai-floating-scanner.tsx" ]; then
    cp components/ai-floating-scanner.tsx "$TARGET_APP/components/"
    echo "  ✓ ai-floating-scanner.tsx"
else
    echo "  ❌ ai-floating-scanner.tsx not found"
fi

# Copy documentation
echo ""
echo "📚 Copying documentation..."
if [ -f "MONEY_MAKER_COPY_GUIDE.md" ]; then
    cp MONEY_MAKER_COPY_GUIDE.md "$TARGET_APP/"
    echo "  ✓ MONEY_MAKER_COPY_GUIDE.md"
fi

if [ -f "MONEY_MAKER_QUICKCOPY.txt" ]; then
    cp MONEY_MAKER_QUICKCOPY.txt "$TARGET_APP/"
    echo "  ✓ MONEY_MAKER_QUICKCOPY.txt"
fi

echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo "✅ Copy Complete!"
echo "═══════════════════════════════════════════════════════════════════"
echo ""
echo "📝 Next Steps:"
echo "   1. cd $TARGET_APP"
echo "   2. npm install recharts (if not already installed)"
echo "   3. npx shadcn-ui@latest add badge button card input switch tabs"
echo "   4. Import and integrate MoneyMakerTab in your page/dashboard"
echo ""
echo "📖 For detailed instructions, see: $TARGET_APP/MONEY_MAKER_COPY_GUIDE.md"
echo ""

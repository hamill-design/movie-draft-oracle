#!/bin/bash
# Verification script for Vercel deployment setup
# Run: bash verify-vercel-setup.sh

echo "🔍 Verifying Vercel Deployment Configuration..."
echo ""

ERRORS=0

# Check 1: requirements.txt should NOT be in root
echo "✅ Check 1: requirements.txt location"
if [ -f "requirements.txt" ]; then
    echo "   ❌ ERROR: requirements.txt found in root directory!"
    echo "   → Should be moved to scripts/letterboxd/requirements.txt"
    ERRORS=$((ERRORS + 1))
else
    echo "   ✅ requirements.txt not in root (correct)"
fi

# Check 2: requirements.txt SHOULD be in scripts/letterboxd/
if [ -f "scripts/letterboxd/requirements.txt" ]; then
    echo "   ✅ requirements.txt found in scripts/letterboxd/ (correct)"
else
    echo "   ⚠️  WARNING: requirements.txt not found in scripts/letterboxd/"
fi

# Check 3: .vercelignore exists
echo ""
echo "✅ Check 2: .vercelignore file"
if [ -f ".vercelignore" ]; then
    echo "   ✅ .vercelignore exists"
    if grep -q "requirements.txt" .vercelignore && grep -q "*.py" .vercelignore; then
        echo "   ✅ .vercelignore contains Python exclusions"
    else
        echo "   ⚠️  WARNING: .vercelignore may be missing Python exclusions"
    fi
else
    echo "   ❌ ERROR: .vercelignore not found!"
    ERRORS=$((ERRORS + 1))
fi

# Check 4: vercel.json configuration
echo ""
echo "✅ Check 3: vercel.json configuration"
if [ -f "vercel.json" ]; then
    echo "   ✅ vercel.json exists"
    if grep -q '"installCommand"' vercel.json; then
        echo "   ✅ installCommand is explicitly set"
    else
        echo "   ⚠️  WARNING: installCommand not explicitly set in vercel.json"
    fi
    if grep -q '"buildCommand"' vercel.json; then
        echo "   ✅ buildCommand is set"
    fi
else
    echo "   ⚠️  WARNING: vercel.json not found (may use auto-detection)"
fi

# Check 5: No Python files in root
echo ""
echo "✅ Check 4: Python files in root directory"
PYTHON_FILES=$(find . -maxdepth 1 -name "*.py" 2>/dev/null | wc -l | tr -d ' ')
if [ "$PYTHON_FILES" -gt 0 ]; then
    echo "   ⚠️  WARNING: Found $PYTHON_FILES Python file(s) in root directory"
    find . -maxdepth 1 -name "*.py" 2>/dev/null
else
    echo "   ✅ No Python files in root directory"
fi

# Summary
echo ""
echo "=========================================="
if [ $ERRORS -eq 0 ]; then
    echo "✅ All checks passed! Ready for deployment."
    echo ""
    echo "Next steps:"
    echo "1. Commit these changes:"
    echo "   git add ."
    echo "   git commit -m 'Fix: Remove Python deps from Vercel build'"
    echo "   git push"
    echo ""
    echo "2. In Vercel dashboard:"
    echo "   - Clear build cache (Settings → General → Clear Build Cache)"
    echo "   - Redeploy or push a new commit"
else
    echo "❌ Found $ERRORS error(s). Please fix before deploying."
    exit 1
fi

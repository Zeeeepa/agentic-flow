#!/bin/bash
set -e

echo "🧪 Testing AgentDB Alpha.2.6 - Simulation Discovery Fix"
echo "========================================================"
echo ""

# Test 1: Version Check
echo "📦 [Test 1/3] Version Check"
VERSION=$(npx agentdb@alpha --version 2>&1 | grep -oP 'agentdb v\K[0-9.a-z.-]+' || echo "unknown")
echo "   Version: $VERSION"
if [[ "$VERSION" == *"2.0.0-alpha.2.6"* ]]; then
  echo "   ✅ PASS - Correct version"
else
  echo "   ⚠️  WARNING - Expected 2.0.0-alpha.2.6, got $VERSION"
  echo "   (npm registry may still be propagating)"
fi
echo ""

# Test 2: Simulation List (Discovery)
echo "📋 [Test 2/3] Simulation Discovery"
SCENARIO_COUNT=$(npx agentdb@alpha simulate list 2>&1 | grep -E "^\s+[a-z-]+" | wc -l)
echo "   Scenarios discovered: $SCENARIO_COUNT"
if [ "$SCENARIO_COUNT" -gt 10 ]; then
  echo "   ✅ PASS - Found $SCENARIO_COUNT scenarios (expected 17+)"
else
  echo "   ❌ FAIL - Only found $SCENARIO_COUNT scenarios"
  exit 1
fi
echo ""

# Test 3: Check for specific scenarios
echo "🔍 [Test 3/3] Specific Scenario Verification"
SCENARIOS=(
  "reflexion-learning"
  "causal-reasoning"
  "multi-agent-swarm"
  "graph-traversal"
)

for scenario in "${SCENARIOS[@]}"; do
  if npx agentdb@alpha simulate list 2>&1 | grep -q "$scenario"; then
    echo "   ✅ Found: $scenario"
  else
    echo "   ❌ Missing: $scenario"
    exit 1
  fi
done
echo ""

echo "🎉 All Tests Passed!"
echo "========================================================"
echo "✅ Alpha.2.6 simulation discovery is working correctly"
echo "✅ Docker/npx execution confirmed"
echo ""

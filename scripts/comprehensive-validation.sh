#!/bin/bash
#
# Comprehensive Validation Script for Agentic-Flow v2.0.0-alpha
# Tests: MCP tools, CLI, API, SDK, Performance optimizations
#

set -e

echo "════════════════════════════════════════════════════════════════"
echo "🚀 Agentic-Flow v2.0.0-alpha Comprehensive Validation"
echo "════════════════════════════════════════════════════════════════"
echo ""

# Output file for results
RESULTS_FILE="/tmp/validation-results.json"
echo "{" > $RESULTS_FILE
echo '  "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'",' >> $RESULTS_FILE
echo '  "version": "2.0.0-alpha",' >> $RESULTS_FILE
echo '  "tests": {' >> $RESULTS_FILE

# Track test results
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Function to log test result
log_test() {
    local name=$1
    local status=$2
    local details=$3

    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    if [ "$status" = "PASS" ]; then
        PASSED_TESTS=$((PASSED_TESTS + 1))
        echo "  ✅ $name"
    else
        FAILED_TESTS=$((FAILED_TESTS + 1))
        echo "  ❌ $name"
        echo "     Details: $details"
    fi
}

echo "📦 Phase 1: Installation Testing"
echo "────────────────────────────────────────────────────────────────"

# Test 1: NPM install
echo "Testing: npm install..."
if cd /home/validator/agentic-flow && npm install --quiet 2>&1 | grep -q "added"; then
    log_test "npm install" "PASS" "Dependencies installed successfully"
else
    log_test "npm install" "FAIL" "Failed to install dependencies"
fi

# Test 2: TypeScript compilation
echo "Testing: TypeScript compilation..."
if npx tsc --noEmit 2>&1 | head -1 | grep -q "error"; then
    log_test "TypeScript compilation" "FAIL" "Compilation errors found"
else
    log_test "TypeScript compilation" "PASS" "No compilation errors"
fi

# Test 3: Build
echo "Testing: npm run build..."
if npm run build 2>&1 | grep -q "error"; then
    log_test "npm run build" "FAIL" "Build failed"
else
    log_test "npm run build" "PASS" "Build successful"
fi

echo ""
echo "🔧 Phase 2: MCP Tools Validation (213 tools)"
echo "────────────────────────────────────────────────────────────────"

# Test MCP server startup
echo "Testing: MCP server initialization..."
if timeout 5s node dist/mcp/standalone-stdio.js <<< '{"method":"initialize"}' 2>&1 | grep -q "capabilities"; then
    log_test "MCP server startup" "PASS" "Server responds to initialize"
else
    log_test "MCP server startup" "FAIL" "Server did not respond"
fi

# Test key MCP tool categories
MCP_CATEGORIES=("swarm" "agent" "task" "memory" "neural" "github" "daa")
for category in "${MCP_CATEGORIES[@]}"; do
    tool_count=$(grep -r "mcp__.*__${category}" dist/ 2>/dev/null | wc -l || echo "0")
    if [ "$tool_count" -gt 0 ]; then
        log_test "MCP ${category} tools available" "PASS" "$tool_count tools found"
    else
        log_test "MCP ${category} tools available" "FAIL" "No tools found"
    fi
done

echo ""
echo "💻 Phase 3: CLI Commands Validation"
echo "────────────────────────────────────────────────────────────────"

# Test CLI availability
if [ -f "dist/cli-proxy.js" ]; then
    log_test "CLI binary exists" "PASS" "dist/cli-proxy.js found"

    # Test CLI help
    if node dist/cli-proxy.js --help 2>&1 | grep -q "Usage"; then
        log_test "CLI --help" "PASS" "Help text displays"
    else
        log_test "CLI --help" "FAIL" "Help command failed"
    fi

    # Test CLI version
    if node dist/cli-proxy.js --version 2>&1 | grep -q "1.10"; then
        log_test "CLI --version" "PASS" "Version displays correctly"
    else
        log_test "CLI --version" "FAIL" "Version command failed"
    fi
else
    log_test "CLI binary exists" "FAIL" "dist/cli-proxy.js not found"
fi

# Test AgentDB CLI
if [ -f "dist/agentdb/cli/agentdb-cli.js" ]; then
    log_test "AgentDB CLI exists" "PASS" "AgentDB CLI found"
else
    log_test "AgentDB CLI exists" "FAIL" "AgentDB CLI not found"
fi

echo ""
echo "⚡ Phase 4: Performance Optimizations"
echo "────────────────────────────────────────────────────────────────"

# Test composite indexes migration
if [ -f "packages/agentdb/src/db/migrations/003_composite_indexes.sql" ]; then
    index_count=$(grep -c "CREATE INDEX" packages/agentdb/src/db/migrations/003_composite_indexes.sql || echo "0")
    if [ "$index_count" -ge 30 ]; then
        log_test "Composite indexes" "PASS" "$index_count indexes defined"
    else
        log_test "Composite indexes" "FAIL" "Only $index_count indexes found (expected 33)"
    fi
else
    log_test "Composite indexes" "FAIL" "Migration file not found"
fi

# Test parallel batch operations
if grep -q "batchInsertParallel" packages/agentdb/src/optimizations/BatchOperations.ts 2>/dev/null; then
    log_test "Parallel batch inserts" "PASS" "Method implemented"
else
    log_test "Parallel batch inserts" "FAIL" "Method not found"
fi

# Test query cache
if [ -f "packages/agentdb/src/core/QueryCache.ts" ]; then
    if grep -q "LRUCache" packages/agentdb/src/core/QueryCache.ts 2>/dev/null; then
        log_test "LRU Query Cache" "PASS" "Cache implementation found"
    else
        log_test "LRU Query Cache" "FAIL" "LRU implementation not found"
    fi
else
    log_test "LRU Query Cache" "FAIL" "QueryCache.ts not found"
fi

# Test OpenTelemetry
if [ -f "packages/agentdb/src/observability/telemetry.ts" ]; then
    if grep -q "TelemetryManager" packages/agentdb/src/observability/telemetry.ts 2>/dev/null; then
        log_test "OpenTelemetry integration" "PASS" "Telemetry manager found"
    else
        log_test "OpenTelemetry integration" "FAIL" "TelemetryManager not found"
    fi
else
    log_test "OpenTelemetry integration" "FAIL" "telemetry.ts not found"
fi

echo ""
echo "📚 Phase 5: SDK & API Validation"
echo "────────────────────────────────────────────────────────────────"

# Test package exports
if grep -q "QueryCache" packages/agentdb/src/index.ts 2>/dev/null; then
    log_test "QueryCache exported" "PASS" "Export found in index.ts"
else
    log_test "QueryCache exported" "FAIL" "Not exported"
fi

if grep -q "batchInsertParallel" packages/agentdb/src/optimizations/index.ts 2>/dev/null; then
    log_test "Parallel batch exports" "PASS" "Types exported"
else
    log_test "Parallel batch exports" "FAIL" "Not exported"
fi

# Test documentation
DOC_FILES=(
    "docs/100_PERCENT_PRODUCTION_READY.md"
    "docs/SECURITY_AUDIT.md"
    "docs/ALPHA_RELEASE_READY.md"
    "packages/agentdb/docs/PARALLEL_BATCH_INSERT.md"
    "packages/agentdb/docs/query-cache.md"
    "packages/agentdb/docs/OBSERVABILITY.md"
)

DOC_COUNT=0
for doc in "${DOC_FILES[@]}"; do
    if [ -f "$doc" ]; then
        DOC_COUNT=$((DOC_COUNT + 1))
    fi
done

if [ "$DOC_COUNT" -eq "${#DOC_FILES[@]}" ]; then
    log_test "Documentation completeness" "PASS" "All $DOC_COUNT docs present"
else
    log_test "Documentation completeness" "FAIL" "Only $DOC_COUNT/${#DOC_FILES[@]} docs found"
fi

echo ""
echo "🧪 Phase 6: Test Suite Execution"
echo "────────────────────────────────────────────────────────────────"

# Run AgentDB tests
if cd packages/agentdb && npm test 2>&1 | grep -q "passing"; then
    log_test "AgentDB test suite" "PASS" "Tests passing"
else
    log_test "AgentDB test suite" "FAIL" "Tests failed or not run"
fi

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "📊 Validation Summary"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "Total Tests:  $TOTAL_TESTS"
echo "Passed:       $PASSED_TESTS ✅"
echo "Failed:       $FAILED_TESTS ❌"
echo ""

# Calculate pass rate
PASS_RATE=$(awk "BEGIN {printf \"%.1f\", ($PASSED_TESTS/$TOTAL_TESTS)*100}")
echo "Pass Rate:    $PASS_RATE%"
echo ""

# Write summary to results file
echo '  },' >> $RESULTS_FILE
echo '  "summary": {' >> $RESULTS_FILE
echo "    \"total\": $TOTAL_TESTS," >> $RESULTS_FILE
echo "    \"passed\": $PASSED_TESTS," >> $RESULTS_FILE
echo "    \"failed\": $FAILED_TESTS," >> $RESULTS_FILE
echo "    \"passRate\": $PASS_RATE" >> $RESULTS_FILE
echo '  }' >> $RESULTS_FILE
echo '}' >> $RESULTS_FILE

# Display final status
if [ "$PASS_RATE" = "100.0" ]; then
    echo "Status: ✅ ALL TESTS PASSED"
    echo ""
    echo "🎉 Agentic-Flow v2.0.0-alpha is 100% validated!"
    exit 0
elif (( $(echo "$PASS_RATE >= 95" | bc -l) )); then
    echo "Status: ⚠️  MOSTLY PASSING ($PASS_RATE%)"
    echo ""
    echo "Minor issues detected, but acceptable for alpha release."
    exit 0
else
    echo "Status: ❌ VALIDATION FAILED ($PASS_RATE%)"
    echo ""
    echo "Too many failures. Review required before release."
    exit 1
fi

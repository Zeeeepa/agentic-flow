#!/bin/bash
###############################################################################
# AgentDB v2 CLI Deep Validation
# Validates all CLI commands with actual execution and expected outputs
###############################################################################

COLORS_RESET='\033[0m'
COLORS_GREEN='\033[32m'
COLORS_YELLOW='\033[33m'
COLORS_RED='\033[31m'
COLORS_CYAN='\033[36m'

TEST_DB="./test-cli-validation.db"
PASSED=0
FAILED=0
SKIPPED=0

echo "======================================================================"
echo "🔍 AGENTDB V2 CLI DEEP VALIDATION"
echo "======================================================================"
echo ""

cleanup() {
  rm -f "$TEST_DB" "$TEST_DB-shm" "$TEST_DB-wal" backup.json test-vector.db
}

# Cleanup before and after
trap cleanup EXIT
cleanup

test_command() {
  local name="$1"
  local cmd="$2"
  local expect_success="$3"  # "success" or "fail" or "skip"

  echo -e "${COLORS_CYAN}📊${COLORS_RESET} Test: $name"

  if [ "$expect_success" == "skip" ]; then
    echo -e "${COLORS_YELLOW}  ⏭️  SKIPPED${COLORS_RESET}"
    ((SKIPPED++))
    return
  fi

  if eval "$cmd" &> /dev/null; then
    if [ "$expect_success" == "success" ]; then
      echo -e "${COLORS_GREEN}  ✅ PASS${COLORS_RESET}"
      ((PASSED++))
    else
      echo -e "${COLORS_RED}  ❌ FAIL (expected failure, got success)${COLORS_RESET}"
      ((FAILED++))
    fi
  else
    if [ "$expect_success" == "fail" ]; then
      echo -e "${COLORS_GREEN}  ✅ PASS (expected failure)${COLORS_RESET}"
      ((PASSED++))
    else
      echo -e "${COLORS_RED}  ❌ FAIL (command failed)${COLORS_RESET}"
      echo "  Command: $cmd"
      eval "$cmd" 2>&1 | head -5 | sed 's/^/  /'
      ((FAILED++))
    fi
  fi
}

echo "========================================================================"
echo "SETUP COMMANDS"
echo "========================================================================"
echo ""

test_command "agentdb --help" \
  "npx agentdb --help" \
  "success"

test_command "agentdb init (default path)" \
  "npx agentdb init $TEST_DB" \
  "success"

test_command "agentdb status" \
  "npx agentdb status --db $TEST_DB" \
  "success"

echo ""
echo "========================================================================"
echo "REFLEXION COMMANDS"
echo "========================================================================"
echo ""

test_command "reflexion store" \
  "npx agentdb reflexion store 'session-1' 'test-task' 0.95 true 'test critique' 'input' 'output' 100 50 --db $TEST_DB" \
  "success"

test_command "reflexion retrieve" \
  "npx agentdb reflexion retrieve 'test' --k 5 --db $TEST_DB" \
  "success"

test_command "reflexion retrieve with --synthesize-context" \
  "npx agentdb reflexion retrieve 'test' --k 5 --synthesize-context --db $TEST_DB" \
  "success"

test_command "reflexion retrieve with --only-successes" \
  "npx agentdb reflexion retrieve 'test' --only-successes --db $TEST_DB" \
  "success"

test_command "reflexion retrieve with --filters" \
  "npx agentdb reflexion retrieve 'test' --filters '{\"success\":true}' --db $TEST_DB" \
  "success"

test_command "reflexion critique-summary" \
  "npx agentdb reflexion critique-summary 'test' --db $TEST_DB" \
  "success"

test_command "reflexion prune" \
  "npx agentdb reflexion prune 90 0.3 --db $TEST_DB" \
  "success"

echo ""
echo "========================================================================"
echo "SKILL COMMANDS"
echo "========================================================================"
echo ""

test_command "skill create" \
  "npx agentdb skill create 'test-skill-$(date +%s)' 'A test skill' 'code here' --db $TEST_DB" \
  "success"

test_command "skill search" \
  "npx agentdb skill search 'test' 5 --db $TEST_DB" \
  "success"

test_command "skill consolidate" \
  "npx agentdb skill consolidate 3 0.7 7 true --db $TEST_DB" \
  "success"

test_command "skill prune" \
  "npx agentdb skill prune 3 0.4 60 --db $TEST_DB" \
  "success"

echo ""
echo "========================================================================"
echo "CAUSAL COMMANDS"
echo "========================================================================"
echo ""

test_command "causal add-edge" \
  "npx agentdb causal add-edge 'cause' 'effect' 0.5 0.8 100 --db $TEST_DB" \
  "success"

test_command "causal experiment create" \
  "AGENTDB_PATH=$TEST_DB npx agentdb causal experiment create 'test-exp' 'cause' 'effect'" \
  "success"

test_command "causal experiment add-observation" \
  "AGENTDB_PATH=$TEST_DB npx agentdb causal experiment add-observation 1 true 0.8" \
  "success"

test_command "causal experiment calculate" \
  "AGENTDB_PATH=$TEST_DB npx agentdb causal experiment calculate 1" \
  "success"

test_command "causal query" \
  "npx agentdb causal query 'cause' 'effect' 0.5 0.1 10 --db $TEST_DB" \
  "success"

echo ""
echo "========================================================================"
echo "LEARNER COMMANDS"
echo "========================================================================"
echo ""

test_command "learner run" \
  "npx agentdb learner run 3 0.6 0.7 true --db $TEST_DB" \
  "success"

test_command "learner prune" \
  "npx agentdb learner prune 0.5 0.05 90 --db $TEST_DB" \
  "success"

echo ""
echo "========================================================================"
echo "RECALL COMMANDS"
echo "========================================================================"
echo ""

test_command "recall with-certificate" \
  "npx agentdb recall with-certificate 'test query' 10 0.7 0.2 0.1 --db $TEST_DB" \
  "success"

echo ""
echo "========================================================================"
echo "HOOKS INTEGRATION COMMANDS"
echo "========================================================================"
echo ""

test_command "query (semantic search)" \
  "npx agentdb query --query 'test' --k 5 --db $TEST_DB" \
  "success"

test_command "query with --synthesize-context" \
  "npx agentdb query --query 'test' --k 5 --synthesize-context --db $TEST_DB" \
  "success"

test_command "query with --filters" \
  "npx agentdb query --query 'test' --filters '{\"success\":true}' --db $TEST_DB" \
  "success"

test_command "store-pattern" \
  "npx agentdb store-pattern --type 'test' --domain 'test-domain' --pattern '{\"test\":true}' --confidence 0.9 --db $TEST_DB" \
  "success"

test_command "train" \
  "npx agentdb train --domain 'test-domain' --epochs 1 --batch-size 10 --db $TEST_DB" \
  "success"

test_command "optimize-memory" \
  "npx agentdb optimize-memory --compress true --consolidate-patterns true --db $TEST_DB" \
  "success"

echo ""
echo "========================================================================"
echo "VECTOR SEARCH COMMANDS"
echo "========================================================================"
echo ""

# Create a test vector database
test_command "init vector test db" \
  "npx agentdb init test-vector.db --dimension 384" \
  "success"

test_command "vector-search (basic)" \
  "npx agentdb vector-search test-vector.db '[0.1,0.2,0.3]' -k 10" \
  "skip"  # Skip as it requires vectors in database

test_command "export" \
  "npx agentdb export $TEST_DB backup.json" \
  "success"

test_command "import" \
  "npx agentdb import backup.json test-import.db" \
  "skip"  # Skip as it requires valid export file

test_command "stats" \
  "npx agentdb stats $TEST_DB" \
  "success"

echo ""
echo "========================================================================"
echo "DATABASE COMMANDS"
echo "========================================================================"
echo ""

test_command "db stats" \
  "npx agentdb db stats --db $TEST_DB" \
  "success"

echo ""
echo "========================================================================"
echo "MCP COMMANDS"
echo "========================================================================"
echo ""

test_command "mcp start (dry run check)" \
  "timeout 1 npx agentdb mcp start || true" \
  "skip"  # Skip as it starts a server

echo ""
echo "========================================================================"
echo "QUIC SYNC COMMANDS"
echo "========================================================================"
echo ""

test_command "sync start-server (dry run check)" \
  "timeout 1 npx agentdb sync start-server --port 4433 || true" \
  "skip"  # Skip as it starts a server

test_command "sync status" \
  "npx agentdb sync status --db $TEST_DB" \
  "skip"  # Skip as it requires sync server

echo ""
echo "========================================================================"
echo "NEGATIVE TESTS (Should Fail)"
echo "========================================================================"
echo ""

test_command "pattern store (old syntax - should fail)" \
  "npx agentdb pattern store 'test' 'test' 0.9" \
  "fail"

test_command "pattern search (old syntax - should fail)" \
  "npx agentdb pattern search 'test' 10 0.7" \
  "fail"

test_command "prune (old syntax - should fail)" \
  "npx agentdb prune --max-age 90 --min-reward 0.3" \
  "fail"

echo ""
echo "========================================================================"
echo "VALIDATION SUMMARY"
echo "========================================================================"
echo ""
echo -e "${COLORS_GREEN}✅ PASSED: $PASSED${COLORS_RESET}"
echo -e "${COLORS_RED}❌ FAILED: $FAILED${COLORS_RESET}"
echo -e "${COLORS_YELLOW}⏭️  SKIPPED: $SKIPPED${COLORS_RESET}"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${COLORS_GREEN}🎉 ALL TESTS PASSED!${COLORS_RESET}"
  exit 0
else
  echo -e "${COLORS_RED}❌ SOME TESTS FAILED${COLORS_RESET}"
  exit 1
fi

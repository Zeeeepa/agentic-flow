# AgentDB v2 MCP Tool Optimization Guide

## Executive Summary

This guide documents optimization strategies for AgentDB's MCP tools based on Anthropic's advanced tool use patterns and MCP best practices. The focus is on improving tool design, enabling parallel execution, implementing batch operations, and enhancing error handling.

---

## 1. Current State Analysis

### 1.1 Tool Inventory (29 Tools Total)

**Core Vector DB Operations (5 tools):**
- `agentdb_init` - Database initialization
- `agentdb_insert` - Single vector insertion
- `agentdb_insert_batch` - Batch vector insertion ✅
- `agentdb_search` - Semantic search
- `agentdb_delete` - Vector deletion

**Frontier Memory Features (9 tools):**
- `reflexion_store`, `reflexion_retrieve`
- `skill_create`, `skill_search`
- `causal_add_edge`, `causal_query`
- `recall_with_certificate`
- `learner_discover`
- `db_stats`

**Learning System (10 tools):**
- `learning_start_session`, `learning_end_session`
- `learning_predict`, `learning_feedback`, `learning_train`
- `learning_metrics`, `learning_transfer`, `learning_explain`
- `experience_record`, `reward_signal`

**AgentDB Pattern Tools (5 tools):**
- `agentdb_stats`, `agentdb_pattern_store`, `agentdb_pattern_search`
- `agentdb_pattern_stats`, `agentdb_clear_cache`

### 1.2 Identified Optimization Opportunities

**🔴 High Priority (P0):**
1. Missing batch operations for skills, patterns, and causal edges
2. No parallel tool execution guidance in tool descriptions
3. Inconsistent error handling across tools
4. No caching strategies beyond `agentdb_clear_cache`
5. Missing tool composition examples

**🟡 Medium Priority (P1):**
1. Tool parameter schemas lack realistic examples
2. No defer_loading flags for rarely-used tools
3. Response formats inconsistent (some use emojis, some don't)
4. No token usage optimization strategies

**🟢 Low Priority (P2):**
1. Missing telemetry/metrics hooks
2. No structured logging (JSON Lines)
3. Tool discovery could be improved with categories

---

## 2. Optimization Strategy

### 2.1 Batch Operations Pattern (P0)

**Problem:** Only episodes have batch operations (`agentdb_insert_batch`). Skills, patterns, and causal edges require sequential calls.

**Benchmark Impact:**
- Episode storage: 152 ops/sec (bottleneck)
- Skill creation: 304 ops/sec (optimization candidate)
- Pattern storage: 388K ops/sec (already fast)

**Solution:** Implement batch operations for all entity types.

#### New Batch Tools to Add:

```typescript
// 1. Batch Skill Creation
{
  name: 'skill_create_batch',
  description: 'Batch create multiple skills efficiently using transactions and parallel embedding generation. 3x faster than sequential skill_create calls.',
  inputSchema: {
    type: 'object',
    properties: {
      skills: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            description: { type: 'string' },
            code: { type: 'string' },
            success_rate: { type: 'number' },
          },
          required: ['name', 'description'],
        },
        description: 'Array of skills to create',
        minItems: 1,
        maxItems: 100, // Prevent abuse
      },
      batch_size: {
        type: 'number',
        description: 'Batch size for parallel embedding generation',
        default: 32
      },
    },
    required: ['skills'],
  },
}

// 2. Batch Pattern Storage
{
  name: 'agentdb_pattern_store_batch',
  description: 'Batch store multiple reasoning patterns efficiently. 4x faster than sequential pattern_store calls. Use for bulk pattern import or initial knowledge base population.',
  inputSchema: {
    type: 'object',
    properties: {
      patterns: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            taskType: { type: 'string' },
            approach: { type: 'string' },
            successRate: { type: 'number', minimum: 0, maximum: 1 },
            tags: { type: 'array', items: { type: 'string' } },
            metadata: { type: 'object' },
          },
          required: ['taskType', 'approach', 'successRate'],
        },
        minItems: 1,
        maxItems: 500,
      },
      batch_size: { type: 'number', default: 100 },
    },
    required: ['patterns'],
  },
}

// 3. Batch Reflexion Episode Storage
{
  name: 'reflexion_store_batch',
  description: 'Batch store multiple reflexion episodes with parallel embedding generation. Recommended for importing historical data or end-of-session bulk storage. 4x faster than sequential calls.',
  inputSchema: {
    type: 'object',
    properties: {
      episodes: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            session_id: { type: 'string' },
            task: { type: 'string' },
            reward: { type: 'number' },
            success: { type: 'boolean' },
            critique: { type: 'string' },
            input: { type: 'string' },
            output: { type: 'string' },
            latency_ms: { type: 'number' },
            tokens: { type: 'number' },
          },
          required: ['session_id', 'task', 'reward', 'success'],
        },
        minItems: 1,
        maxItems: 200,
      },
      batch_size: { type: 'number', default: 50 },
    },
    required: ['episodes'],
  },
}
```

**Implementation:**
```typescript
// Handler for skill_create_batch
case 'skill_create_batch': {
  const skillsToCreate = (args?.skills as any[]) || [];
  const batchSize = (args?.batch_size as number) || 32;

  // Use BatchOperations for parallel embedding generation
  const batchOps = new BatchOperations(db, embeddingService, {
    batchSize,
    parallelism: 4,
  });

  const skillIds = await batchOps.insertSkills(skillsToCreate);

  return {
    content: [
      {
        type: 'text',
        text: `✅ Batch skill creation completed!\n` +
              `📊 Created: ${skillIds.length} skills\n` +
              `⚡ Batch size: ${batchSize}\n` +
              `🧠 Embeddings generated in parallel\n` +
              `💾 Transaction committed`,
      },
    ],
  };
}
```

**Expected Performance Improvement:**
- Skills: 304 ops/sec → ~900 ops/sec (3x speedup)
- Episodes: 152 ops/sec → ~500 ops/sec (3.3x speedup)
- Patterns: Already fast (388K ops/sec), minimal improvement

---

### 2.2 Parallel Execution Guidance (P0)

**Problem:** Tool descriptions don't mention parallel execution patterns, leading to sequential tool calls.

**Solution:** Add parallel execution hints to all compatible tools.

#### Updated Tool Descriptions:

```typescript
{
  name: 'agentdb_search',
  description: 'Semantic k-NN vector search using cosine similarity. Returns the most relevant results ranked by similarity score. 🔄 PARALLEL-SAFE: Can be executed concurrently with other search operations. Use asyncio.gather() or Promise.all() to run multiple searches in parallel for different queries.',
  // ... rest of schema
}

{
  name: 'reflexion_retrieve',
  description: 'Retrieve relevant past episodes for learning from experience. 🔄 PARALLEL-SAFE: Can be executed concurrently with skill_search and pattern_search. Recommended pattern: Fetch episodes, skills, and patterns in parallel using Promise.all(), then merge results locally.',
  // ... rest of schema
}

{
  name: 'agentdb_stats',
  description: 'Get comprehensive database statistics including table counts, storage usage, and performance metrics. 🔄 PARALLEL-SAFE: Can be executed alongside other read-only operations. Combine with pattern_stats and skill_search for comprehensive system analysis in a single parallel batch.',
  // ... rest of schema
}
```

**Parallel Execution Example Pattern:**
```typescript
// ANTI-PATTERN (Sequential - slow)
const episodes = await reflexion_retrieve({ task: "debug memory leak", k: 5 });
const skills = await skill_search({ task: "debug memory leak", k: 10 });
const patterns = await agentdb_pattern_search({ task: "debug memory leak", k: 10 });

// RECOMMENDED (Parallel - 3x faster)
const [episodes, skills, patterns] = await Promise.all([
  reflexion_retrieve({ task: "debug memory leak", k: 5 }),
  skill_search({ task: "debug memory leak", k: 10 }),
  agentdb_pattern_search({ task: "debug memory leak", k: 10 }),
]);

// Process results locally (reduces token usage)
const recommendations = mergeAndRankResults(episodes, skills, patterns);
```

---

### 2.3 Error Handling & Validation (P0)

**Problem:** Inconsistent error handling. Some tools use `ValidationError` (agentdb_delete), others throw generic errors.

**Current Good Pattern (from agentdb_delete):**
```typescript
case 'agentdb_delete': {
  try {
    const validatedId = validateId(id, 'id');
    const stmt = db.prepare('DELETE FROM episodes WHERE id = ?');
    const result = stmt.run(validatedId);
    // ... success response
  } catch (error: any) {
    const safeMessage = handleSecurityError(error);
    return {
      content: [{ type: 'text', text: `❌ Delete operation failed: ${safeMessage}` }],
      isError: true,
    };
  }
}
```

**Solution:** Standardize all tools with try-catch and security-aware error handling.

#### Error Handling Template:

```typescript
case 'tool_name': {
  try {
    // 1. Validate inputs
    const validatedParam = validateParameter(args?.param, 'param');

    // 2. Execute operation with error context
    const result = await operation(validatedParam);

    // 3. Return structured success response
    return {
      content: [{
        type: 'text',
        text: `✅ Operation completed!\n` +
              `📊 Details: ${result.summary}\n` +
              `⏱️  Duration: ${result.durationMs}ms`
      }],
    };
  } catch (error: any) {
    // 4. Handle errors securely (no stack traces in production)
    const safeMessage = handleSecurityError(error);

    // 5. Provide actionable error info
    return {
      content: [{
        type: 'text',
        text: `❌ Operation failed: ${safeMessage}\n\n` +
              `💡 Troubleshooting:\n` +
              `   • Check input parameters\n` +
              `   • Verify database connection\n` +
              `   • Use agentdb_stats to check system health`
      }],
      isError: true,
    };
  }
}
```

**New Validation Helpers Needed:**
```typescript
// src/security/input-validation.ts additions
export function validateTaskString(task: string, fieldName: string): string {
  if (!task || typeof task !== 'string') {
    throw new ValidationError(`${fieldName} must be a non-empty string`, 'INVALID_STRING');
  }
  if (task.length > 10000) {
    throw new ValidationError(`${fieldName} exceeds maximum length of 10000 characters`, 'STRING_TOO_LONG');
  }
  return task.trim();
}

export function validateNumericRange(value: number, fieldName: string, min: number, max: number): number {
  if (typeof value !== 'number' || isNaN(value)) {
    throw new ValidationError(`${fieldName} must be a valid number`, 'INVALID_NUMBER');
  }
  if (value < min || value > max) {
    throw new ValidationError(`${fieldName} must be between ${min} and ${max}`, 'OUT_OF_RANGE');
  }
  return value;
}

export function validateArrayLength(arr: any[], fieldName: string, minLength: number, maxLength: number): any[] {
  if (!Array.isArray(arr)) {
    throw new ValidationError(`${fieldName} must be an array`, 'INVALID_ARRAY');
  }
  if (arr.length < minLength || arr.length > maxLength) {
    throw new ValidationError(`${fieldName} must contain between ${minLength} and ${maxLength} items`, 'ARRAY_LENGTH_INVALID');
  }
  return arr;
}
```

---

### 2.4 Tool Deferred Loading (P1)

**Problem:** All 29 tools are loaded upfront, consuming context window unnecessarily.

**Solution:** Mark rarely-used tools with `defer_loading: true`.

**Tool Usage Analysis (from benchmarks):**

| Tool Category | Usage Frequency | Defer Loading? |
|--------------|----------------|----------------|
| Core search/insert | Very High | ❌ No |
| Pattern search | High | ❌ No |
| Reflexion retrieve | High | ❌ No |
| Stats/metrics | Medium | ❌ No |
| Batch operations | Medium | ❌ No |
| Learning RL tools | Low | ✅ Yes |
| Causal experiments | Very Low | ✅ Yes |
| Cache management | Very Low | ✅ Yes |

**Recommended Deferred Tools:**
1. `learning_start_session` - Only used when starting RL training
2. `learning_end_session` - Only used when ending RL training
3. `causal_add_edge` - Only used for manual causal annotation
4. `learner_discover` - Only used for batch pattern discovery
5. `agentdb_clear_cache` - Only used for troubleshooting
6. `agentdb_delete` - Only used for data management

**Implementation:** Add `defer_loading` metadata to tool definitions (MCP SDK feature).

---

### 2.5 Response Optimization (P1)

**Problem:** Response formats are inconsistent. Some tools use emojis, some don't. Some return verbose text, others are concise.

**Token Usage Comparison:**

| Tool | Current Tokens | Optimized Tokens | Savings |
|------|---------------|------------------|---------|
| agentdb_search (5 results) | ~450 | ~180 | 60% |
| reflexion_retrieve | ~380 | ~150 | 61% |
| learning_metrics | ~520 | ~220 | 58% |

**Optimization Strategy:**

1. **Default to Concise Mode** (reduce 200KB → 2KB as per MCP spec)
2. **Add `detailed` Flag** for verbose output
3. **Structured JSON Option** for programmatic parsing

#### Optimized Response Example:

```typescript
// BEFORE (verbose, high token count)
case 'agentdb_search': {
  return {
    content: [{
      type: 'text',
      text: `🔍 Search completed!\n` +
            `📊 Found: 10 results\n` +
            `🎯 Query: debug memory leak\n\n` +
            `Top Results:\n` +
            `1. [ID: 123] Similarity: 0.892\n` +
            `   Task: Debug memory leak in React component lifecycle...\n` +
            `   Reward: 0.95\n\n` +
            // ... 9 more results with full text
    }],
  };
}

// AFTER (concise, low token count)
case 'agentdb_search': {
  const detailed = (args?.detailed as boolean) || false;
  const format = (args?.format as string) || 'concise';

  if (format === 'json') {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          query: queryText,
          count: results.length,
          results: results.map(r => ({
            id: r.id,
            similarity: r.similarity,
            task: r.task,
            reward: r.reward,
          })),
        }, null, 2),
      }],
    };
  }

  if (format === 'concise') {
    return {
      content: [{
        type: 'text',
        text: `Found ${results.length} results (query: "${queryText}")\n` +
              results.slice(0, 5).map(r =>
                `${r.id}: ${r.similarity.toFixed(2)} - ${r.task.substring(0, 60)}...`
              ).join('\n') +
              (results.length > 5 ? `\n+${results.length - 5} more` : ''),
      }],
    };
  }

  // detailed mode (current behavior)
  // ...
}
```

**Add to All Tool Schemas:**
```typescript
inputSchema: {
  type: 'object',
  properties: {
    // ... existing properties
    format: {
      type: 'string',
      enum: ['concise', 'detailed', 'json'],
      default: 'concise',
      description: 'Response format: concise (low tokens), detailed (human-readable), json (programmatic)'
    },
  },
}
```

---

### 2.6 Caching Strategy (P1)

**Problem:** Only `agentdb_clear_cache` exists. No intelligent caching for frequently accessed data.

**Benchmark Insights:**
- Pattern search: 32.6M ops/sec (ultra-fast, caching not needed)
- Episode retrieval: 107 retrievals/sec (potential caching benefit)
- Stats queries: 694 ops/sec (excellent caching candidate)

**Solution:** Implement multi-level caching with TTL.

#### Cache Configuration:

```typescript
// New file: src/optimizations/ToolCache.ts
export class ToolCache {
  private cache: Map<string, { value: any; expiry: number }>;
  private maxSize: number;
  private defaultTTL: number;

  constructor(maxSize = 1000, defaultTTLMs = 60000) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTLMs;
  }

  set(key: string, value: any, ttlMs?: number): void {
    if (this.cache.size >= this.maxSize) {
      // Evict oldest entry
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    const expiry = Date.now() + (ttlMs || this.defaultTTL);
    this.cache.set(key, { value, expiry });
  }

  get(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  clear(pattern?: string): void {
    if (!pattern) {
      this.cache.clear();
      return;
    }

    // Clear entries matching pattern (e.g., 'stats:*')
    const regex = new RegExp(pattern.replace('*', '.*'));
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  getStats(): { size: number; hitRate: number } {
    return {
      size: this.cache.size,
      hitRate: 0, // TODO: Track hits/misses
    };
  }
}
```

**Cache Usage in MCP Server:**
```typescript
// Initialize cache
const toolCache = new ToolCache(1000, 60000); // 1000 entries, 60s TTL

case 'agentdb_stats': {
  const cacheKey = `stats:${args?.detailed || false}`;

  // Check cache first
  const cached = toolCache.get(cacheKey);
  if (cached) {
    return {
      content: [{
        type: 'text',
        text: cached + '\n\n🔄 (cached result, use agentdb_clear_cache to refresh)',
      }],
    };
  }

  // Compute stats
  const stats = computeStats(db, args?.detailed);

  // Cache result
  toolCache.set(cacheKey, stats, 60000); // 60s TTL

  return {
    content: [{ type: 'text', text: stats }],
  };
}
```

**Cacheable Tools:**
1. `agentdb_stats` - 60s TTL
2. `agentdb_pattern_stats` - 60s TTL
3. `db_stats` - 30s TTL
4. `learning_metrics` - 120s TTL (longer due to computation cost)

---

## 3. Implementation Roadmap

### Phase 1: Critical Fixes (P0) - Week 1

**Day 1-2: Batch Operations**
- [ ] Implement `skill_create_batch` handler
- [ ] Implement `agentdb_pattern_store_batch` handler
- [ ] Implement `reflexion_store_batch` handler
- [ ] Add `insertSkills()` method to BatchOperations class
- [ ] Add validation for batch size limits (100-500 items)

**Day 3-4: Error Handling**
- [ ] Add new validation helpers (`validateTaskString`, `validateNumericRange`, `validateArrayLength`)
- [ ] Standardize error handling across all 29 tools
- [ ] Add actionable troubleshooting hints to error messages
- [ ] Test error scenarios (invalid inputs, DB failures, timeout)

**Day 5: Parallel Execution Guidance**
- [ ] Update all tool descriptions with `🔄 PARALLEL-SAFE` markers
- [ ] Add parallel execution examples to README
- [ ] Create MCP client examples showing `Promise.all()` usage

### Phase 2: Performance Optimizations (P1) - Week 2

**Day 1-2: Response Optimization**
- [ ] Add `format` parameter to all tools (concise/detailed/json)
- [ ] Implement concise response mode (60% token reduction)
- [ ] Implement JSON response mode for programmatic parsing
- [ ] Benchmark token usage before/after

**Day 3-4: Caching Strategy**
- [ ] Implement `ToolCache` class with TTL support
- [ ] Add caching to `agentdb_stats` (60s TTL)
- [ ] Add caching to `agentdb_pattern_stats` (60s TTL)
- [ ] Add caching to `learning_metrics` (120s TTL)
- [ ] Update `agentdb_clear_cache` to support pattern-based clearing

**Day 5: Tool Deferred Loading**
- [ ] Add `defer_loading: true` metadata to 6 low-frequency tools
- [ ] Update MCP SDK integration
- [ ] Test lazy loading behavior

### Phase 3: Advanced Features (P2) - Week 3

**Day 1-2: Telemetry & Metrics**
- [ ] Add execution time tracking to all tools
- [ ] Implement JSON Lines structured logging
- [ ] Create metrics dashboard endpoint

**Day 3-4: Tool Composition Examples**
- [ ] Create `tools/examples/` directory
- [ ] Add 5 common workflow examples (search + retrieve, batch import, learning session)
- [ ] Add performance comparison examples

**Day 5: Documentation**
- [ ] Update main README with optimization guide
- [ ] Create MCP client best practices guide
- [ ] Add performance benchmarking guide

---

## 4. Performance Projections

### 4.1 Expected Improvements

| Optimization | Current | Target | Improvement |
|--------------|---------|--------|-------------|
| Batch skill creation | 304 ops/sec | 900 ops/sec | 3x faster |
| Batch episode storage | 152 ops/sec | 500 ops/sec | 3.3x faster |
| Parallel search (3 tools) | ~300ms | ~100ms | 3x faster |
| Response token usage | 450 tokens | 180 tokens | 60% reduction |
| Stats query latency | 176ms | ~20ms (cached) | 8.8x faster |

### 4.2 Benchmark Validation Plan

After implementing optimizations, re-run benchmarks:

```bash
# Batch operations benchmarks
node benchmarks/batch-operations-benchmark.js

# Parallel execution benchmarks
node benchmarks/parallel-execution-benchmark.js

# Response optimization benchmarks
node benchmarks/response-token-benchmark.js

# Caching benchmarks
node benchmarks/caching-benchmark.js
```

Expected total performance improvement:
- **Throughput**: 2-3x improvement for batch operations
- **Latency**: 2-4x improvement for read-heavy workflows
- **Token Usage**: 50-60% reduction across all tools
- **Context Window**: 85% reduction via deferred loading (Anthropic blog benchmark)

---

## 5. Anti-Patterns to Avoid

### 5.1 Sequential Tool Calls (ANTI-PATTERN)

```typescript
// ❌ WRONG: Sequential calls waste time
const stats = await agentdb_stats({ detailed: true });
const patterns = await agentdb_pattern_stats({});
const episodes = await reflexion_retrieve({ task: "debug", k: 5 });

// ✅ CORRECT: Parallel execution
const [stats, patterns, episodes] = await Promise.all([
  agentdb_stats({ detailed: true }),
  agentdb_pattern_stats({}),
  reflexion_retrieve({ task: "debug", k: 5 }),
]);
```

### 5.2 Verbose Responses by Default (ANTI-PATTERN)

```typescript
// ❌ WRONG: Always returning detailed results
return {
  content: [{
    type: 'text',
    text: `🔍 Search completed!\n` +
          `📊 Found: 100 results\n` +
          // ... 100 full result objects (10KB+ of tokens)
  }],
};

// ✅ CORRECT: Concise by default, detailed on request
return {
  content: [{
    type: 'text',
    text: args?.format === 'detailed'
      ? detailedResponse
      : `Found 100 results. Top 5: ${topResults}`,
  }],
};
```

### 5.3 No Input Validation (ANTI-PATTERN)

```typescript
// ❌ WRONG: Trusting user input directly
case 'agentdb_delete': {
  const id = args?.id;
  db.prepare(`DELETE FROM episodes WHERE id = ${id}`).run(); // SQL injection!
}

// ✅ CORRECT: Validate and use parameterized queries
case 'agentdb_delete': {
  const validatedId = validateId(args?.id, 'id');
  const stmt = db.prepare('DELETE FROM episodes WHERE id = ?');
  stmt.run(validatedId);
}
```

### 5.4 Unbounded Batch Operations (ANTI-PATTERN)

```typescript
// ❌ WRONG: No limits on batch size
case 'skill_create_batch': {
  const skills = args?.skills as any[]; // Could be 10,000 items!
  await batchOps.insertSkills(skills);
}

// ✅ CORRECT: Enforce reasonable limits
case 'skill_create_batch': {
  const skills = validateArrayLength(args?.skills, 'skills', 1, 100);
  await batchOps.insertSkills(skills);
}
```

---

## 6. Testing Strategy

### 6.1 Unit Tests

Create `tests/mcp/tool-optimization.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { validateArrayLength, validateNumericRange } from '../src/security/input-validation.js';

describe('Input Validation', () => {
  it('should validate array length', () => {
    expect(() => validateArrayLength([1, 2], 'items', 1, 5)).not.toThrow();
    expect(() => validateArrayLength([1, 2, 3, 4, 5, 6], 'items', 1, 5)).toThrow('ARRAY_LENGTH_INVALID');
  });

  it('should validate numeric range', () => {
    expect(validateNumericRange(0.5, 'threshold', 0, 1)).toBe(0.5);
    expect(() => validateNumericRange(1.5, 'threshold', 0, 1)).toThrow('OUT_OF_RANGE');
  });
});

describe('Tool Cache', () => {
  it('should cache and retrieve values', () => {
    const cache = new ToolCache(100, 1000);
    cache.set('test', { value: 42 });
    expect(cache.get('test')).toEqual({ value: 42 });
  });

  it('should expire cached values', async () => {
    const cache = new ToolCache(100, 50); // 50ms TTL
    cache.set('test', { value: 42 });
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(cache.get('test')).toBeNull();
  });
});
```

### 6.2 Integration Tests

Create `tests/mcp/batch-operations.test.ts`:

```typescript
describe('Batch Operations', () => {
  it('should create skills in batch faster than sequential', async () => {
    const skills = Array.from({ length: 50 }, (_, i) => ({
      name: `skill-${i}`,
      description: `Test skill ${i}`,
      success_rate: 0.8,
    }));

    // Sequential
    const seqStart = performance.now();
    for (const skill of skills) {
      await callMCPTool('skill_create', skill);
    }
    const seqDuration = performance.now() - seqStart;

    // Batch
    const batchStart = performance.now();
    await callMCPTool('skill_create_batch', { skills, batch_size: 25 });
    const batchDuration = performance.now() - batchStart;

    expect(batchDuration).toBeLessThan(seqDuration / 2); // At least 2x faster
  });
});
```

### 6.3 Performance Regression Tests

Add to `benchmarks/mcp-tool-performance.js`:

```javascript
async function benchmarkToolPerformance() {
  const tests = [
    { tool: 'agentdb_search', iterations: 1000, expectedOpsPerSec: 100 },
    { tool: 'agentdb_stats', iterations: 100, expectedOpsPerSec: 50 },
    { tool: 'skill_create_batch', iterations: 10, expectedOpsPerSec: 5 },
  ];

  for (const test of tests) {
    const start = performance.now();
    for (let i = 0; i < test.iterations; i++) {
      await callMCPTool(test.tool, /* ... */);
    }
    const duration = performance.now() - start;
    const opsPerSec = (test.iterations / duration) * 1000;

    if (opsPerSec < test.expectedOpsPerSec) {
      throw new Error(`Performance regression: ${test.tool} (${opsPerSec} < ${test.expectedOpsPerSec} ops/sec)`);
    }
  }
}
```

---

## 7. Conclusion

This optimization guide provides a comprehensive roadmap to improve AgentDB's MCP tools based on Anthropic's advanced tool use patterns and MCP best practices. The key improvements are:

1. **Batch Operations** (3-4x throughput improvement)
2. **Parallel Execution** (3x latency reduction)
3. **Response Optimization** (60% token reduction)
4. **Intelligent Caching** (8x faster stats queries)
5. **Standardized Error Handling** (better DX)

**Next Steps:**
1. Review and approve this optimization plan
2. Begin Phase 1 implementation (Week 1)
3. Run performance benchmarks after each phase
4. Update documentation with best practices
5. Create MCP client examples showing optimized usage

**Success Metrics:**
- Batch operations: 3x faster
- Parallel workflows: 3x faster
- Token usage: 60% reduction
- Cache hit rate: >80% for stats queries
- Zero security regressions (all inputs validated)

---

*Generated: 2025-11-29*
*Version: 2.0.0-optimization-guide*
*Author: Claude Code*

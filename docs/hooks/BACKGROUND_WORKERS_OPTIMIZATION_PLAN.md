# Background Workers Optimization Plan

## Ultra-Deep Analysis & Implementation Strategy

> **Goal**: Non-blocking background workers triggered by keywords that run silently while conversation continues, depositing results into memory for later retrieval.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current Infrastructure Analysis](#2-current-infrastructure-analysis)
3. [Core Architecture](#3-core-architecture)
4. [Worker Types & Specifications](#4-worker-types--specifications)
5. [Hook Integration Strategy](#5-hook-integration-strategy)
6. [Memory & Storage Architecture](#6-memory--storage-architecture)
7. [Performance Optimizations](#7-performance-optimizations)
8. [Implementation Phases](#8-implementation-phases)
9. [Advanced Patterns](#9-advanced-patterns)
10. [Monitoring & Observability](#10-monitoring--observability)

---

## 1. Executive Summary

### The Vision

```
User: "ultralearn how the auth system works"
      ↓
UserPromptSubmit hook detects "ultralearn"
      ↓
Spawns background Task agents (run_in_background: true)
      ↓
User keeps chatting, workers run silently
      ↓
Results stored in AgentDB + ReasoningBank
      ↓
Future queries automatically enriched with background results
```

### Key Differentiators

| Aspect | Traditional Skills | Background Workers |
|--------|-------------------|-------------------|
| Execution | Blocking | Non-blocking |
| Duration | Immediate return | Minutes of deep work |
| Output | Single response | Continuous memory deposits |
| User Experience | Wait for result | Keep working |
| Learning | None | ReasoningBank patterns |
| Storage | Ephemeral | Persistent vector memory |

### Performance Targets

| Metric | Target | Mechanism |
|--------|--------|-----------|
| Trigger detection | < 5ms | Regex + hash table lookup |
| Worker spawn | < 50ms | Pre-warmed agent pools |
| Memory writes | < 10ms | AgentDB HNSW indexing |
| Result surfacing | < 20ms | Vector similarity search |
| Max workers | 10 concurrent | Resource governor |
| Memory efficiency | < 100MB per worker | Streaming + chunking |

---

## 2. Current Infrastructure Analysis

### Available Components

#### 2.1 Hook System (hooks.ts)
```typescript
// Current capabilities from hooks.ts:
- hookPreEditTool        // Pre-edit validation & agent suggestion
- hookPostEditTool       // Post-edit learning & pattern storage
- hookPreCommandTool     // Command risk assessment
- hookPostCommandTool    // Command outcome recording
- hookRouteTool          // Q-learning agent routing
- hookExplainTool        // Routing decision explanation
- hookPretrainTool       // Repository analysis bootstrapping
- hookMetricsTool        // Learning metrics dashboard
- hookTransferTool       // Cross-project pattern transfer

// Intelligence layer (RuVector):
- intelligenceRouteTool          // SONA + MoE + HNSW routing
- intelligenceTrajectoryStartTool // Begin RL trajectory
- intelligenceTrajectoryStepTool  // Record trajectory step
- intelligenceTrajectoryEndTool   // Complete trajectory with learning
- intelligencePatternStoreTool    // Store in ReasoningBank
- intelligencePatternSearchTool   // HNSW pattern retrieval
- intelligenceStatsTool           // Intelligence layer stats
- intelligenceLearnTool           // Force SONA learning cycle
- intelligenceAttentionTool       // MoE/Flash/Hyperbolic attention
```

#### 2.2 ReasoningBank Capabilities
```typescript
// Core features from reasoningbank/:
- storePattern()         // Store task-resolution pairs
- searchPatterns()       // HNSW-indexed similarity search
- trajectoryStart/End()  // Reinforcement learning trajectories
- consolidate()          // Memory consolidation
- distill()              // Knowledge distillation
- judge()                // Pattern quality evaluation
- retrieve()             // Context-aware retrieval

// Advanced features:
- SONA Micro-LoRA (~0.05ms adaptation)
- EWC++ (Elastic Weight Consolidation)
- MoE Attention (Mixture of Experts)
- HNSW indexing (150x faster than brute force)
```

#### 2.3 SDK Hooks Bridge (hooks-bridge.ts)
```typescript
// Claude Agent SDK integration:
- PreToolUse hook        // Before tool execution
- PostToolUse hook       // After successful execution
- PostToolUseFailure     // After failed execution
- SessionStart hook      // Session initialization
- SessionEnd hook        // Session cleanup
- SubagentStart/Stop     // Agent lifecycle

// Key feature: activeTrajectories Map with TTL
// - Tracks running trajectories per session
// - Auto-cleanup after 5 minutes
```

#### 2.4 Swarm Learning Optimizer
```typescript
// From swarm-learning-optimizer.ts:
- storeExecutionPattern()    // Record swarm execution metrics
- getOptimization()          // Get optimal topology recommendation
- calculateReward()          // Q-learning reward function
- getOptimizationStats()     // Aggregated statistics
```

### Gaps to Address

1. **No Background Execution**: Current hooks are synchronous
2. **No Trigger Detection**: No keyword-based worker dispatch
3. **No Worker Registry**: No tracking of running background tasks
4. **No Result Surfacing**: No automatic context injection
5. **No Worker Chaining**: No sequential/parallel worker orchestration
6. **No Resource Governance**: No limits on concurrent workers

---

## 3. Core Architecture

### 3.1 System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Claude Code Session                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────┐    ┌─────────────────┐    ┌────────────────┐  │
│  │ UserPromptSubmit│───>│ TriggerDetector │───>│ WorkerDispatch │  │
│  │      Hook       │    │  (< 5ms)        │    │    Service     │  │
│  └─────────────────┘    └─────────────────┘    └───────┬────────┘  │
│                                                         │           │
│  ┌──────────────────────────────────────────────────────┼──────────┤
│  │                    Background Execution Layer         │          │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐     │          │
│  │  │ Worker Pool│  │ Task Queue │  │  Resource  │<────┘          │
│  │  │ (pre-warm) │  │  (FIFO)    │  │  Governor  │               │
│  │  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘               │
│  │        │               │               │                       │
│  │  ┌─────┴───────────────┴───────────────┴──────┐               │
│  │  │              Worker Executor               │               │
│  │  │  ┌─────────┐ ┌─────────┐ ┌─────────┐      │               │
│  │  │  │ultralearn│ │optimize │ │ audit   │ ... │               │
│  │  │  └────┬────┘ └────┬────┘ └────┬────┘      │               │
│  │  └───────┼───────────┼───────────┼───────────┘               │
│  └──────────┼───────────┼───────────┼────────────────────────────┤
│             │           │           │                            │
│  ┌──────────┴───────────┴───────────┴────────────────────────────┤
│  │                    Memory Layer                               │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐           │
│  │  │   AgentDB   │  │ReasoningBank│  │ Worker State│           │
│  │  │ (HNSW/Vec)  │  │  (Patterns) │  │  Registry   │           │
│  │  └─────────────┘  └─────────────┘  └─────────────┘           │
│  └───────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌───────────────────────────────────────────────────────────────┤
│  │                  Context Injection Layer                      │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐           │
│  │  │PromptEnrich │  │ ResultSurface│  │StatusMonitor│           │
│  │  └─────────────┘  └─────────────┘  └─────────────┘           │
│  └───────────────────────────────────────────────────────────────┤
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 Component Specifications

#### TriggerDetector
```typescript
interface TriggerConfig {
  keyword: string;
  worker: WorkerType;
  priority: 'low' | 'medium' | 'high' | 'critical';
  maxAgents: number;
  timeout: number;        // Max execution time (ms)
  cooldown: number;       // Min time between same trigger (ms)
  topicExtractor: RegExp; // Extract topic from prompt
}

const TRIGGER_MAP: Map<string, TriggerConfig> = new Map([
  ['ultralearn', {
    worker: 'research-swarm',
    priority: 'high',
    maxAgents: 5,
    timeout: 300000,      // 5 minutes
    cooldown: 60000,      // 1 minute
    topicExtractor: /ultralearn\s+(.+?)(?:\.|$)/i
  }],
  ['optimize', {
    worker: 'perf-analyzer',
    priority: 'medium',
    maxAgents: 2,
    timeout: 180000,
    cooldown: 120000,
    topicExtractor: /optimize\s+(.+?)(?:\.|$)/i
  }],
  ['consolidate', {
    worker: 'memory-optimizer',
    priority: 'low',
    maxAgents: 1,
    timeout: 120000,
    cooldown: 300000,
    topicExtractor: null  // No topic needed
  }],
  ['predict', {
    worker: 'pattern-matcher',
    priority: 'medium',
    maxAgents: 2,
    timeout: 60000,
    cooldown: 30000,
    topicExtractor: /predict\s+(.+?)(?:\.|$)/i
  }],
  ['audit', {
    worker: 'security-scanner',
    priority: 'high',
    maxAgents: 3,
    timeout: 300000,
    cooldown: 180000,
    topicExtractor: /audit\s+(.+?)(?:\.|$)/i
  }],
  ['map', {
    worker: 'dependency-mapper',
    priority: 'medium',
    maxAgents: 2,
    timeout: 240000,
    cooldown: 300000,
    topicExtractor: /map\s+(.+?)(?:\.|$)/i
  }],
  ['preload', {
    worker: 'context-prefetcher',
    priority: 'low',
    maxAgents: 1,
    timeout: 30000,
    cooldown: 10000,
    topicExtractor: /preload\s+(.+?)(?:\.|$)/i
  }],
  ['deepdive', {
    worker: 'call-graph-analyzer',
    priority: 'high',
    maxAgents: 4,
    timeout: 600000,      // 10 minutes
    cooldown: 300000,
    topicExtractor: /deepdive\s+(.+?)(?:\.|$)/i
  }]
]);
```

#### WorkerDispatchService
```typescript
interface WorkerDispatchService {
  // Core dispatch
  dispatch(trigger: string, topic: string, sessionId: string): Promise<WorkerId>;

  // Worker management
  getStatus(workerId: WorkerId): WorkerStatus;
  getAllWorkers(sessionId?: string): WorkerInfo[];
  cancel(workerId: WorkerId): Promise<boolean>;

  // Resource management
  getResourceUsage(): ResourceStats;
  setResourceLimits(limits: ResourceLimits): void;

  // Result retrieval
  getResults(workerId: WorkerId): Promise<WorkerResults>;
  awaitCompletion(workerId: WorkerId, timeout?: number): Promise<WorkerResults>;
}

interface WorkerStatus {
  id: WorkerId;
  trigger: string;
  topic: string;
  status: 'queued' | 'running' | 'complete' | 'failed' | 'cancelled';
  progress: number;       // 0-100
  startedAt: number;
  estimatedCompletion?: number;
  currentPhase?: string;
  memoryDeposits: number; // Count of items written to memory
}
```

#### WorkerRegistry (SQLite-backed)
```sql
-- Worker state persistence
CREATE TABLE IF NOT EXISTS background_workers (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  trigger TEXT NOT NULL,
  topic TEXT,
  status TEXT DEFAULT 'queued',
  progress INTEGER DEFAULT 0,
  current_phase TEXT,
  started_at INTEGER,
  completed_at INTEGER,
  error_message TEXT,
  memory_deposits INTEGER DEFAULT 0,
  result_keys TEXT,  -- JSON array of memory keys
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX idx_workers_session ON background_workers(session_id);
CREATE INDEX idx_workers_status ON background_workers(status);
CREATE INDEX idx_workers_trigger ON background_workers(trigger);

-- Worker metrics
CREATE TABLE IF NOT EXISTS worker_metrics (
  worker_id TEXT PRIMARY KEY,
  files_analyzed INTEGER DEFAULT 0,
  patterns_found INTEGER DEFAULT 0,
  memory_bytes_written INTEGER DEFAULT 0,
  cpu_time_ms INTEGER DEFAULT 0,
  peak_memory_mb REAL DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  FOREIGN KEY (worker_id) REFERENCES background_workers(id)
);
```

---

## 4. Worker Types & Specifications

### 4.1 ultralearn - Deep Research Swarm

**Purpose**: Comprehensive codebase learning for a specific topic

```typescript
interface UltralearnWorker {
  trigger: 'ultralearn';
  phases: [
    'discovery',      // Find relevant files
    'analysis',       // Deep code analysis
    'relationship',   // Build dependency graph
    'vectorization',  // Create embeddings
    'summarization',  // Generate insights
    'indexing'        // Store in HNSW
  ];

  outputs: {
    filesAnalyzed: string[];
    dependencyGraph: DependencyNode[];
    codePatterns: Pattern[];
    keyInsights: string[];
    suggestedFollowups: string[];
    vectorEmbeddings: number[][];  // For similarity search
  };

  memoryKeys: {
    summary: 'ultralearn/{topic}/summary';
    graph: 'ultralearn/{topic}/dependencies';
    patterns: 'ultralearn/{topic}/patterns';
    vectors: 'ultralearn/{topic}/vectors';
  };
}
```

**Agent Allocation**:
```typescript
const ultralearnSwarm = {
  topology: 'hierarchical',
  agents: [
    { type: 'coordinator', role: 'orchestrate phases' },
    { type: 'scout-explorer', role: 'discover relevant files', count: 2 },
    { type: 'code-analyzer', role: 'deep analysis', count: 2 },
    { type: 'pattern-matcher', role: 'identify patterns' }
  ]
};
```

**Algorithm**:
```
Phase 1: Discovery (parallel grep + glob)
  - Search codebase for topic keywords
  - Identify file clusters by naming patterns
  - Find import/export relationships

Phase 2: Analysis (parallel file reads)
  - Parse ASTs for structure understanding
  - Extract function/class signatures
  - Identify design patterns

Phase 3: Relationship Mapping
  - Build call graph
  - Map data flow
  - Identify architectural layers

Phase 4: Vectorization
  - Generate embeddings for each file section
  - Create topic-clustered vectors
  - Store in HNSW index

Phase 5: Summarization
  - Generate natural language summary
  - List key insights
  - Suggest follow-up questions

Phase 6: Memory Deposit
  - Store all outputs in AgentDB
  - Update ReasoningBank patterns
  - Index for future retrieval
```

### 4.2 optimize - Performance Analyzer

**Purpose**: Analyze workflow patterns and pre-optimize common operations

```typescript
interface OptimizeWorker {
  trigger: 'optimize';
  phases: [
    'pattern-analysis',   // Analyze recent activity
    'bottleneck-detect',  // Find slow patterns
    'cache-warmup',       // Pre-load hot paths
    'route-optimize',     // Optimize agent routing
    'prediction-build'    // Build prediction models
  ];

  outputs: {
    hotFiles: FileAccessPattern[];
    slowCommands: CommandProfile[];
    cacheSuggestions: CacheRecommendation[];
    routingOptimizations: RoutingChange[];
    predictions: AccessPrediction[];
  };

  memoryKeys: {
    hotFiles: 'optimize/hot-files';
    bottlenecks: 'optimize/bottlenecks';
    cache: 'optimize/cache-warmup';
    routing: 'optimize/routing';
  };
}
```

**Integration with ReasoningBank**:
```typescript
async function optimizeWorker(sessionId: string) {
  const rb = await ReasoningBank.connect();

  // Analyze past trajectories
  const trajectories = await rb.searchPatterns('session', {
    k: 1000,
    minReward: 0.5
  });

  // Extract patterns
  const fileAccess = extractFileAccessPatterns(trajectories);
  const commandPatterns = extractCommandPatterns(trajectories);

  // Build predictions using SONA
  const predictions = await rb.predict({
    action: 'next-file-access',
    context: fileAccess,
    algorithm: 'decision-transformer'
  });

  // Pre-warm cache
  for (const pred of predictions.slice(0, 10)) {
    await preloadFileContext(pred.file, {
      confidence: pred.score,
      reason: pred.rationale
    });
  }

  // Store optimizations
  await AgentDB.store({
    collection: 'optimize-results',
    key: `session:${sessionId}`,
    data: {
      hotFiles: fileAccess.hot,
      predictions,
      optimizedAt: Date.now()
    }
  });
}
```

### 4.3 consolidate - Memory Optimizer

**Purpose**: Compress, merge, and optimize stored memories

```typescript
interface ConsolidateWorker {
  trigger: 'consolidate';
  phases: [
    'inventory',      // Catalog all memories
    'similarity',     // Find similar entries
    'merge',          // Merge duplicates
    'prune',          // Remove stale entries
    'reindex',        // Rebuild HNSW indices
    'compress'        // Compress storage
  ];

  outputs: {
    memoriesReviewed: number;
    memoriesMerged: number;
    memoriesPruned: number;
    spaceReclaimed: number;
    newIndexStats: IndexStats;
  };

  memoryKeys: {
    report: 'consolidate/report/{timestamp}';
  };
}
```

**Algorithm**:
```typescript
async function consolidateWorker() {
  const db = await AgentDB.connect();
  const rb = await ReasoningBank.connect();

  // Phase 1: Inventory
  const allCollections = await db.listCollections();
  const inventory = {};

  for (const collection of allCollections) {
    inventory[collection] = await db.count({ collection });
  }

  // Phase 2: Find similar entries using HNSW
  const duplicateCandidates = [];
  for (const collection of allCollections) {
    const entries = await db.scan({ collection, limit: 10000 });

    for (const entry of entries) {
      const similar = await db.vectorSearch({
        query: entry.vector,
        collection,
        limit: 5,
        minScore: 0.95  // Very high similarity
      });

      if (similar.length > 1) {
        duplicateCandidates.push({
          primary: entry,
          duplicates: similar.slice(1)
        });
      }
    }
  }

  // Phase 3: Merge duplicates
  let merged = 0;
  for (const { primary, duplicates } of duplicateCandidates) {
    const mergedEntry = mergeEntries(primary, duplicates);
    await db.update(primary.id, mergedEntry);

    for (const dup of duplicates) {
      await db.delete(dup.id);
      merged++;
    }
  }

  // Phase 4: Prune stale entries (older than 30 days, low access)
  const staleThreshold = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const pruned = await db.deleteWhere({
    filter: {
      lastAccessed: { $lt: staleThreshold },
      accessCount: { $lt: 3 }
    }
  });

  // Phase 5: Rebuild HNSW indices
  await db.rebuildIndices();

  // Phase 6: Run SQLite vacuum
  await db.vacuum();

  return {
    memoriesReviewed: Object.values(inventory).reduce((a, b) => a + b, 0),
    memoriesMerged: merged,
    memoriesPruned: pruned,
    spaceReclaimed: await db.getSpaceReclaimed()
  };
}
```

### 4.4 predict - Pattern Matcher

**Purpose**: Pre-fetch likely needed files based on learned patterns

```typescript
interface PredictWorker {
  trigger: 'predict';
  phases: [
    'context-gather',     // Get current context
    'pattern-match',      // Match against history
    'predict',            // Generate predictions
    'preload',            // Pre-fetch files
    'cache'               // Cache for quick access
  ];

  outputs: {
    predictions: FilePrediction[];
    preloadedFiles: string[];
    confidence: number;
  };
}
```

**ReasoningBank Integration**:
```typescript
async function predictWorker(topic: string, sessionId: string) {
  const rb = await ReasoningBank.connect();

  // Get current session context
  const currentFiles = await getRecentlyAccessedFiles(sessionId);
  const currentTask = await getCurrentTaskDescription(sessionId);

  // Search for similar past sessions
  const similarSessions = await rb.searchPatterns(currentTask, {
    k: 20,
    minReward: 0.7,
    onlySuccesses: true
  });

  // Extract file sequences from successful patterns
  const fileSequences = similarSessions.map(s => {
    const output = JSON.parse(s.output);
    return output.filesAccessed || [];
  });

  // Build prediction using sequence analysis
  const predictions = predictNextFiles(currentFiles, fileSequences);

  // Preload top predictions
  for (const pred of predictions.slice(0, 5)) {
    await preloadFileIntoCache(pred.file);
  }

  // Store predictions for quick access
  await AgentDB.store({
    collection: 'predictions',
    key: `session:${sessionId}`,
    data: {
      predictions,
      generatedAt: Date.now(),
      basedOn: similarSessions.length
    }
  });
}
```

### 4.5 audit - Security Scanner

**Purpose**: Deep security and code quality analysis running silently

```typescript
interface AuditWorker {
  trigger: 'audit';
  phases: [
    'inventory',          // List all files
    'static-analysis',    // AST-based checks
    'dependency-scan',    // Check dependencies
    'secret-detection',   // Find leaked secrets
    'vulnerability-check',// CVE matching
    'quality-metrics',    // Code quality scores
    'report-generation'   // Generate report
  ];

  outputs: {
    filesScanned: number;
    vulnerabilities: Vulnerability[];
    secrets: SecretLeak[];
    qualityScores: QualityMetrics;
    recommendations: string[];
    overallRisk: 'low' | 'medium' | 'high' | 'critical';
  };

  memoryKeys: {
    report: 'audit/report/{timestamp}';
    vulnerabilities: 'audit/vulnerabilities';
    recommendations: 'audit/recommendations';
  };
}
```

### 4.6 map - Dependency Mapper

**Purpose**: Build comprehensive dependency graphs in background

```typescript
interface MapWorker {
  trigger: 'map';
  phases: [
    'file-discovery',     // Find all source files
    'import-analysis',    // Parse imports/exports
    'graph-build',        // Build dependency graph
    'cycle-detection',    // Find circular deps
    'layer-analysis',     // Identify architecture layers
    'visualization-prep'  // Prepare for rendering
  ];

  outputs: {
    graph: DependencyGraph;
    cycles: Cycle[];
    layers: ArchitectureLayer[];
    hotspots: Hotspot[];      // High-coupling areas
    orphans: string[];        // Unused files
    entryPoints: string[];    // Main entry points
  };
}
```

### 4.7 Additional Worker Types

```typescript
// More worker definitions
const ADDITIONAL_WORKERS = {
  'document': {
    trigger: 'document',
    purpose: 'Generate documentation for discovered patterns',
    phases: ['analyze', 'template', 'generate', 'format', 'store']
  },

  'refactor': {
    trigger: 'refactor',
    purpose: 'Identify refactoring opportunities',
    phases: ['complexity', 'duplication', 'coupling', 'suggestions']
  },

  'benchmark': {
    trigger: 'benchmark',
    purpose: 'Run performance benchmarks silently',
    phases: ['discover', 'instrument', 'execute', 'analyze', 'report']
  },

  'test-gaps': {
    trigger: 'testgaps',
    purpose: 'Find untested code paths',
    phases: ['coverage', 'paths', 'criticality', 'suggestions']
  },

  'debt': {
    trigger: 'debt',
    purpose: 'Quantify technical debt',
    phases: ['analyze', 'categorize', 'prioritize', 'estimate']
  },

  'explain': {
    trigger: 'explain',
    purpose: 'Build comprehensive system diagrams',
    phases: ['discover', 'analyze', 'diagram', 'annotate']
  }
};
```

---

## 5. Hook Integration Strategy

### 5.1 UserPromptSubmit Hook Configuration

```json
{
  "UserPromptSubmit": [{
    "matcher": {
      "type": "regex",
      "pattern": "\\b(ultralearn|optimize|consolidate|predict|audit|map|preload|deepdive|document|refactor|benchmark|testgaps|debt|explain)\\b"
    },
    "hooks": [{
      "type": "command",
      "command": "npx agentic-flow workers dispatch \"$USER_PROMPT\" --session \"$SESSION_ID\"",
      "timeout": 5000,
      "background": true,
      "continueOnError": true
    }]
  }]
}
```

### 5.2 Dispatch Command Implementation

```typescript
// src/cli/commands/workers.ts

import { Command } from 'commander';
import { WorkerDispatchService } from '../../workers/dispatch';
import { TriggerDetector } from '../../workers/trigger-detector';

export function createWorkersCommand(): Command {
  const workers = new Command('workers')
    .description('Background worker management');

  workers
    .command('dispatch <prompt>')
    .description('Detect triggers and dispatch background workers')
    .option('-s, --session <id>', 'Session ID')
    .option('-p, --priority <level>', 'Override priority')
    .action(async (prompt: string, options) => {
      const detector = new TriggerDetector();
      const dispatcher = new WorkerDispatchService();

      // Detect all triggers in prompt
      const triggers = detector.detect(prompt);

      if (triggers.length === 0) {
        // No triggers found, silent exit
        return;
      }

      // Dispatch workers for each trigger
      const workerIds = [];
      for (const trigger of triggers) {
        const workerId = await dispatcher.dispatch(
          trigger.keyword,
          trigger.topic,
          options.session
        );
        workerIds.push(workerId);

        // Output for user feedback (shown in hook response)
        console.log(`⚡ ${trigger.keyword}: spawned worker ${workerId}`);
      }
    });

  workers
    .command('status [workerId]')
    .description('Get worker status')
    .option('-a, --all', 'Show all workers')
    .option('-s, --session <id>', 'Filter by session')
    .action(async (workerId, options) => {
      const dispatcher = new WorkerDispatchService();

      if (workerId) {
        const status = await dispatcher.getStatus(workerId);
        displayWorkerStatus(status);
      } else {
        const workers = await dispatcher.getAllWorkers(options.session);
        displayWorkerTable(workers);
      }
    });

  workers
    .command('cancel <workerId>')
    .description('Cancel a running worker')
    .action(async (workerId) => {
      const dispatcher = new WorkerDispatchService();
      const cancelled = await dispatcher.cancel(workerId);
      console.log(cancelled ? '✅ Worker cancelled' : '❌ Could not cancel');
    });

  workers
    .command('results <workerId>')
    .description('Get worker results')
    .option('-f, --format <type>', 'Output format', 'summary')
    .action(async (workerId, options) => {
      const dispatcher = new WorkerDispatchService();
      const results = await dispatcher.getResults(workerId);
      displayResults(results, options.format);
    });

  return workers;
}
```

### 5.3 Context Injection Hook

```typescript
// Automatically inject background results into prompts

const contextInjectionHook = {
  event: 'UserPromptSubmit',
  hooks: [{
    type: 'command',
    command: 'npx agentic-flow workers inject-context "$USER_PROMPT" --session "$SESSION_ID"',
    timeout: 2000
  }]
};

// inject-context command
async function injectContext(prompt: string, sessionId: string) {
  const db = await AgentDB.connect();

  // Search for relevant completed worker results
  const relevant = await db.vectorSearch({
    query: prompt,
    collections: [
      'ultralearn-results',
      'optimize-results',
      'audit-results',
      'map-results',
      'predict-results'
    ],
    limit: 3,
    minScore: 0.7
  });

  if (relevant.length === 0) {
    return; // No relevant background context
  }

  // Format context for injection
  const context = relevant.map(r => ({
    source: r.collection,
    summary: r.data.summary || r.data.keyInsights?.[0],
    relevance: r.score
  }));

  // Output as system message injection
  console.log('<background-context>');
  console.log(JSON.stringify(context, null, 2));
  console.log('</background-context>');
}
```

### 5.4 Status Display Hook

```typescript
// Hook for "status" command to show worker dashboard

const statusHook = {
  event: 'UserPromptSubmit',
  matcher: /^\s*(status|workers?)\s*$/i,
  hooks: [{
    type: 'command',
    command: 'npx agentic-flow workers status --session "$SESSION_ID" --format dashboard'
  }]
};

function displayWorkerDashboard(workers: WorkerInfo[]) {
  console.log('┌─ Background Workers ──────────────────────┐');

  for (const worker of workers) {
    const icon = {
      'complete': '✅',
      'running': '🔄',
      'queued': '💤',
      'failed': '❌',
      'cancelled': '⏹️'
    }[worker.status];

    const progress = worker.status === 'running'
      ? `(${worker.progress}%)`
      : '';

    console.log(`│ ${icon} ${worker.trigger.padEnd(12)}: ${worker.status} ${progress}`.padEnd(43) + '│');

    if (worker.currentPhase) {
      console.log(`│   └─ ${worker.currentPhase}`.padEnd(43) + '│');
    }
  }

  console.log('└───────────────────────────────────────────┘');
}
```

---

## 6. Memory & Storage Architecture

### 6.1 AgentDB Schema for Background Workers

```typescript
// Collection definitions
const WORKER_COLLECTIONS = {
  // Worker state
  'background-jobs': {
    keyFormat: 'job:{workerId}',
    ttl: 86400000,  // 24 hours
    indexed: ['status', 'trigger', 'sessionId']
  },

  // Worker results by type
  'ultralearn-results': {
    keyFormat: 'ultralearn:{topic}:{timestamp}',
    ttl: null,  // Persistent
    indexed: ['topic'],
    vectorized: true  // Enable HNSW
  },

  'optimize-results': {
    keyFormat: 'optimize:{sessionId}:{timestamp}',
    ttl: 604800000,  // 7 days
    indexed: ['sessionId']
  },

  'audit-results': {
    keyFormat: 'audit:{timestamp}',
    ttl: null,  // Persistent
    indexed: ['riskLevel']
  },

  'map-results': {
    keyFormat: 'map:{scope}:{timestamp}',
    ttl: null,  // Persistent
    indexed: ['scope']
  },

  'predict-results': {
    keyFormat: 'predict:{sessionId}:{timestamp}',
    ttl: 3600000,  // 1 hour
    indexed: ['sessionId']
  },

  // Learning summaries (quick access)
  'learning-summaries': {
    keyFormat: '{trigger}:{topic}',
    ttl: null,
    indexed: ['trigger', 'topic'],
    vectorized: true
  },

  // File access patterns (for prediction)
  'file-access-log': {
    keyFormat: 'access:{sessionId}:{file}',
    ttl: 86400000,
    indexed: ['sessionId', 'file', 'timestamp']
  },

  // Command history (for optimization)
  'command-history': {
    keyFormat: 'cmd:{sessionId}:{timestamp}',
    ttl: 86400000,
    indexed: ['sessionId', 'command', 'success']
  }
};
```

### 6.2 ReasoningBank Integration

```typescript
// Pattern storage for worker learning
interface WorkerPattern {
  sessionId: string;
  task: string;              // Worker trigger + topic
  input: string;             // Initial context
  output: string;            // Worker results
  reward: number;            // 0-1 success score
  success: boolean;
  latencyMs: number;
  tokensUsed: number;
  critique: string;          // Self-assessment
}

// Store worker execution pattern
async function storeWorkerPattern(
  worker: WorkerInfo,
  results: WorkerResults
): Promise<void> {
  const rb = await ReasoningBank.connect();

  await rb.storePattern({
    sessionId: `worker:${worker.id}`,
    task: `${worker.trigger} ${worker.topic || ''}`,
    input: JSON.stringify({
      trigger: worker.trigger,
      topic: worker.topic,
      startedAt: worker.startedAt
    }),
    output: JSON.stringify({
      results: results.data,
      memoryDeposits: worker.memoryDeposits,
      duration: Date.now() - worker.startedAt
    }),
    reward: calculateWorkerReward(worker, results),
    success: results.status === 'complete',
    latencyMs: Date.now() - worker.startedAt,
    tokensUsed: results.tokensUsed || 0,
    critique: generateWorkerCritique(worker, results)
  });
}

function calculateWorkerReward(
  worker: WorkerInfo,
  results: WorkerResults
): number {
  let reward = 0.5;  // Base for completion

  // Bonus for completing all phases
  if (results.status === 'complete') {
    reward += 0.2;
  }

  // Bonus for useful memory deposits
  if (worker.memoryDeposits > 5) {
    reward += 0.15;
  }

  // Bonus for fast completion
  const duration = Date.now() - worker.startedAt;
  const expectedDuration = TRIGGER_MAP.get(worker.trigger)?.timeout || 300000;
  if (duration < expectedDuration * 0.5) {
    reward += 0.15;
  }

  return Math.min(1.0, reward);
}
```

### 6.3 Memory Access Patterns

```typescript
// Efficient memory access patterns for workers

class WorkerMemoryManager {
  private db: AgentDB;
  private rb: ReasoningBank;
  private cache: Map<string, any>;

  constructor() {
    this.cache = new Map();
  }

  async store(
    collection: string,
    key: string,
    data: any,
    options?: {
      vectorize?: boolean;
      ttl?: number;
      metadata?: Record<string, any>;
    }
  ): Promise<void> {
    // Store in AgentDB
    await this.db.store({
      collection,
      key,
      data,
      ttl: options?.ttl,
      metadata: options?.metadata
    });

    // Optionally create vector embedding
    if (options?.vectorize) {
      const embedding = await this.generateEmbedding(data);
      await this.db.storeVector({
        collection: `${collection}-vectors`,
        key,
        vector: embedding,
        metadata: { originalKey: key, ...options?.metadata }
      });
    }

    // Update cache
    this.cache.set(`${collection}:${key}`, data);
  }

  async searchRelevant(
    query: string,
    collections: string[],
    options?: {
      limit?: number;
      minScore?: number;
    }
  ): Promise<SearchResult[]> {
    const results = [];

    // Search each collection
    for (const collection of collections) {
      const matches = await this.db.vectorSearch({
        query,
        collection: `${collection}-vectors`,
        limit: options?.limit || 5,
        minScore: options?.minScore || 0.7
      });

      // Fetch full data for matches
      for (const match of matches) {
        const data = await this.db.get({
          collection,
          key: match.metadata.originalKey
        });

        results.push({
          collection,
          key: match.metadata.originalKey,
          data,
          score: match.score
        });
      }
    }

    // Sort by relevance
    return results.sort((a, b) => b.score - a.score);
  }

  async streamResults(
    workerId: string,
    callback: (update: MemoryUpdate) => void
  ): Promise<void> {
    // Subscribe to worker memory updates
    const subscription = await this.db.subscribe({
      pattern: `worker:${workerId}:*`,
      callback: (key, data) => {
        callback({
          key,
          data,
          timestamp: Date.now()
        });
      }
    });

    return subscription;
  }
}
```

---

## 7. Performance Optimizations

### 7.1 Pre-Warmed Agent Pools

```typescript
// Maintain pool of ready-to-use agents
class AgentPool {
  private pools: Map<string, Agent[]> = new Map();
  private config: PoolConfig;

  constructor(config: PoolConfig) {
    this.config = config;
    this.initializePools();
  }

  private async initializePools(): Promise<void> {
    // Pre-create agents for each worker type
    const workerTypes = [
      { type: 'scout-explorer', count: 3 },
      { type: 'code-analyzer', count: 2 },
      { type: 'pattern-matcher', count: 2 },
      { type: 'security-scanner', count: 1 }
    ];

    for (const { type, count } of workerTypes) {
      const agents = [];
      for (let i = 0; i < count; i++) {
        const agent = await this.createAgent(type);
        agents.push(agent);
      }
      this.pools.set(type, agents);
    }
  }

  async acquire(type: string): Promise<Agent> {
    const pool = this.pools.get(type) || [];

    if (pool.length > 0) {
      // Return from pool (< 5ms)
      return pool.pop()!;
    }

    // Create new agent (50-100ms)
    return this.createAgent(type);
  }

  release(agent: Agent): void {
    const pool = this.pools.get(agent.type) || [];

    // Reset agent state
    agent.reset();

    // Return to pool if not at capacity
    if (pool.length < this.config.maxPoolSize) {
      pool.push(agent);
      this.pools.set(agent.type, pool);
    }
  }
}
```

### 7.2 Streaming Memory Writes

```typescript
// Stream results to memory as worker progresses
class StreamingMemoryWriter {
  private buffer: MemoryEntry[] = [];
  private flushInterval: NodeJS.Timer;
  private batchSize = 100;

  constructor(private db: AgentDB) {
    // Flush buffer every 500ms
    this.flushInterval = setInterval(() => this.flush(), 500);
  }

  write(entry: MemoryEntry): void {
    this.buffer.push(entry);

    // Immediate flush if buffer is full
    if (this.buffer.length >= this.batchSize) {
      this.flush();
    }
  }

  private async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const entries = [...this.buffer];
    this.buffer = [];

    // Batch write to AgentDB
    await this.db.batchStore(entries);
  }

  async close(): Promise<void> {
    clearInterval(this.flushInterval);
    await this.flush();
  }
}
```

### 7.3 Parallel File Processing

```typescript
// Process files in parallel with controlled concurrency
async function processFilesParallel(
  files: string[],
  processor: (file: string) => Promise<ProcessResult>,
  options: { concurrency: number; timeout: number }
): Promise<ProcessResult[]> {
  const { concurrency, timeout } = options;
  const results: ProcessResult[] = [];
  const queue = [...files];

  const workers = Array(concurrency).fill(null).map(async () => {
    while (queue.length > 0) {
      const file = queue.shift()!;

      try {
        const result = await Promise.race([
          processor(file),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), timeout)
          )
        ]) as ProcessResult;

        results.push(result);
      } catch (error) {
        results.push({
          file,
          error: error.message,
          success: false
        });
      }
    }
  });

  await Promise.all(workers);
  return results;
}
```

### 7.4 Incremental HNSW Indexing

```typescript
// Add vectors to HNSW incrementally without full rebuild
class IncrementalHNSW {
  private pendingVectors: Vector[] = [];
  private indexVersion: number = 0;

  async addVector(vector: Vector): Promise<void> {
    this.pendingVectors.push(vector);

    // Batch add when we have enough
    if (this.pendingVectors.length >= 100) {
      await this.commitBatch();
    }
  }

  private async commitBatch(): Promise<void> {
    const vectors = [...this.pendingVectors];
    this.pendingVectors = [];

    // Use HNSW incremental update
    await this.db.hnsw.addBatch({
      vectors,
      efConstruction: 200,  // Quality parameter
      M: 16                 // Max connections
    });

    this.indexVersion++;
  }

  async search(
    query: number[],
    k: number
  ): Promise<SearchResult[]> {
    // Commit any pending vectors first
    if (this.pendingVectors.length > 0) {
      await this.commitBatch();
    }

    return this.db.hnsw.search({
      query,
      k,
      ef: 50  // Search parameter
    });
  }
}
```

### 7.5 Resource Governor

```typescript
// Prevent resource exhaustion
class ResourceGovernor {
  private activeWorkers: Map<string, WorkerInfo> = new Map();
  private config: ResourceLimits;

  constructor(config: ResourceLimits) {
    this.config = config;
  }

  canSpawn(trigger: string): { allowed: boolean; reason?: string } {
    // Check total worker count
    if (this.activeWorkers.size >= this.config.maxConcurrentWorkers) {
      return {
        allowed: false,
        reason: `Max workers (${this.config.maxConcurrentWorkers}) reached`
      };
    }

    // Check workers of same type
    const sameType = Array.from(this.activeWorkers.values())
      .filter(w => w.trigger === trigger);

    if (sameType.length >= this.config.maxPerTrigger) {
      return {
        allowed: false,
        reason: `Max ${trigger} workers (${this.config.maxPerTrigger}) reached`
      };
    }

    // Check memory usage
    const memUsage = process.memoryUsage();
    if (memUsage.heapUsed > this.config.maxHeapMB * 1024 * 1024) {
      return {
        allowed: false,
        reason: 'Memory limit exceeded'
      };
    }

    return { allowed: true };
  }

  register(worker: WorkerInfo): void {
    this.activeWorkers.set(worker.id, worker);

    // Set timeout for cleanup
    setTimeout(() => {
      if (this.activeWorkers.has(worker.id)) {
        const w = this.activeWorkers.get(worker.id)!;
        if (w.status !== 'complete') {
          w.status = 'timeout';
          this.unregister(worker.id);
        }
      }
    }, this.config.workerTimeout);
  }

  unregister(workerId: string): void {
    this.activeWorkers.delete(workerId);
  }

  getStats(): ResourceStats {
    return {
      activeWorkers: this.activeWorkers.size,
      workersByType: this.countByType(),
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime()
    };
  }
}
```

---

## 8. Implementation Phases

### Phase 1: Foundation (Week 1-2)

**Deliverables**:
- [ ] TriggerDetector class with regex matching
- [ ] WorkerRegistry with SQLite persistence
- [ ] ResourceGovernor with basic limits
- [ ] CLI `workers` command group

**Files to Create**:
```
src/workers/
├── trigger-detector.ts
├── worker-registry.ts
├── resource-governor.ts
├── dispatch-service.ts
└── types.ts
```

**Testing**:
```typescript
// Test trigger detection
describe('TriggerDetector', () => {
  it('should detect single trigger', () => {
    const detector = new TriggerDetector();
    const triggers = detector.detect('ultralearn auth system');
    expect(triggers).toHaveLength(1);
    expect(triggers[0].keyword).toBe('ultralearn');
    expect(triggers[0].topic).toBe('auth system');
  });

  it('should detect multiple triggers', () => {
    const detector = new TriggerDetector();
    const triggers = detector.detect('optimize and audit the codebase');
    expect(triggers).toHaveLength(2);
  });

  it('should respect cooldown', async () => {
    const detector = new TriggerDetector();
    detector.detect('ultralearn api');

    // Immediate second detection should be blocked
    const triggers = detector.detect('ultralearn auth');
    expect(triggers).toHaveLength(0);
  });
});
```

### Phase 2: Core Workers (Week 3-4)

**Deliverables**:
- [ ] ultralearn worker implementation
- [ ] optimize worker implementation
- [ ] consolidate worker implementation
- [ ] AgentDB integration for results storage

**Worker Implementation Pattern**:
```typescript
// Base worker class
abstract class BackgroundWorker {
  protected id: string;
  protected trigger: string;
  protected topic: string;
  protected memoryWriter: StreamingMemoryWriter;

  abstract get phases(): string[];
  abstract executePhase(phase: string): Promise<PhaseResult>;

  async run(): Promise<WorkerResults> {
    const results: PhaseResult[] = [];

    for (const phase of this.phases) {
      this.updateStatus({ currentPhase: phase });

      try {
        const result = await this.executePhase(phase);
        results.push(result);

        // Update progress
        const progress = ((results.length / this.phases.length) * 100) | 0;
        this.updateStatus({ progress });

        // Stream results to memory
        if (result.data) {
          await this.memoryWriter.write({
            collection: `${this.trigger}-results`,
            key: `${this.id}:${phase}`,
            data: result.data
          });
        }
      } catch (error) {
        return {
          status: 'failed',
          error: error.message,
          completedPhases: results.length
        };
      }
    }

    return {
      status: 'complete',
      results,
      completedPhases: results.length
    };
  }
}

// Specific worker
class UltralearnWorker extends BackgroundWorker {
  get phases() {
    return ['discovery', 'analysis', 'relationship',
            'vectorization', 'summarization', 'indexing'];
  }

  async executePhase(phase: string): Promise<PhaseResult> {
    switch (phase) {
      case 'discovery':
        return this.discoverFiles();
      case 'analysis':
        return this.analyzeFiles();
      // ... other phases
    }
  }

  private async discoverFiles(): Promise<PhaseResult> {
    // Parallel grep for topic keywords
    const patterns = [
      this.topic,
      ...this.topic.split(' ').filter(w => w.length > 3)
    ];

    const files = new Set<string>();

    await Promise.all(patterns.map(async pattern => {
      const matches = await grep(pattern, { type: 'ts,js,tsx,jsx' });
      matches.forEach(f => files.add(f));
    }));

    return {
      phase: 'discovery',
      data: { files: Array.from(files) }
    };
  }
}
```

### Phase 3: Hook Integration (Week 5)

**Deliverables**:
- [ ] UserPromptSubmit hook for trigger detection
- [ ] Context injection hook for result surfacing
- [ ] Status command hook
- [ ] Integration with existing hooks-bridge.ts

**Hook Configuration**:
```typescript
// Add to hooks-bridge.ts
export const backgroundWorkerHooks = {
  UserPromptSubmit: [
    {
      hooks: [userPromptSubmitWorkerHook]
    }
  ]
};

const userPromptSubmitWorkerHook: HookCallback = async (input, toolUseId, { signal }) => {
  if (input.hook_event_name !== 'UserPromptSubmit') return {};

  const prompt = (input as any).prompt || '';
  const sessionId = input.session_id;

  // Detect triggers
  const detector = new TriggerDetector();
  const triggers = detector.detect(prompt);

  if (triggers.length === 0) return {};

  // Dispatch workers
  const dispatcher = new WorkerDispatchService();
  const workerIds = [];

  for (const trigger of triggers) {
    const workerId = await dispatcher.dispatch(
      trigger.keyword,
      trigger.topic,
      sessionId
    );
    workerIds.push(workerId);
  }

  // Return status message
  return {
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext: `⚡ Background workers spawned: ${triggers.map(t => t.keyword).join(', ')}`
    }
  };
};
```

### Phase 4: Result Surfacing (Week 6)

**Deliverables**:
- [ ] Automatic context injection based on query relevance
- [ ] Status dashboard with rich formatting
- [ ] Result retrieval commands
- [ ] ReasoningBank pattern storage

**Context Injection Algorithm**:
```typescript
async function injectRelevantContext(
  prompt: string,
  sessionId: string
): Promise<ContextInjection | null> {
  const db = await AgentDB.connect();
  const rb = await ReasoningBank.connect();

  // 1. Check for completed worker results
  const workerResults = await db.vectorSearch({
    query: prompt,
    collections: WORKER_RESULT_COLLECTIONS,
    limit: 5,
    minScore: 0.7
  });

  // 2. Check for learned patterns
  const patterns = await rb.searchPatterns(prompt, {
    k: 3,
    minReward: 0.8,
    onlySuccesses: true
  });

  // 3. Combine and rank by relevance
  const combined = [
    ...workerResults.map(r => ({
      source: 'worker',
      type: r.collection,
      content: r.data.summary || r.data.keyInsights?.[0],
      score: r.score
    })),
    ...patterns.map(p => ({
      source: 'pattern',
      type: 'learned',
      content: p.output,
      score: p.reward * 0.9  // Slightly lower weight
    }))
  ].sort((a, b) => b.score - a.score);

  if (combined.length === 0) return null;

  // 4. Format for injection
  return {
    context: combined.slice(0, 3),
    source: combined[0].source,
    confidence: combined[0].score
  };
}
```

### Phase 5: Advanced Features (Week 7-8)

**Deliverables**:
- [ ] Worker chaining (sequential/parallel composition)
- [ ] Adaptive swarm sizing based on complexity
- [ ] Learning from worker outcomes
- [ ] Cross-session result persistence

**Worker Chaining**:
```typescript
const WORKER_CHAINS: Record<string, string[]> = {
  'deep-audit': ['map', 'audit', 'optimize'],
  'learn-optimize': ['ultralearn', 'predict', 'preload'],
  'full-refresh': ['consolidate', 'map', 'predict']
};

async function executeChain(
  chainName: string,
  topic: string,
  sessionId: string
): Promise<ChainResult> {
  const chain = WORKER_CHAINS[chainName];
  if (!chain) throw new Error(`Unknown chain: ${chainName}`);

  const results: WorkerResults[] = [];
  let context = { topic };

  for (const worker of chain) {
    // Pass results from previous worker as context
    const result = await executeWorker(worker, {
      ...context,
      previousResults: results
    });

    results.push(result);

    // Update context for next worker
    if (result.data) {
      context = { ...context, ...result.data };
    }
  }

  return {
    chain: chainName,
    workers: chain,
    results,
    status: 'complete'
  };
}
```

---

## 9. Advanced Patterns

### 9.1 Predictive Pre-Loading

```typescript
// Predict and pre-load likely needed context
class PredictivePreloader {
  private accessHistory: FileAccess[] = [];
  private model: ReasoningBank;

  async recordAccess(file: string, sessionId: string): Promise<void> {
    this.accessHistory.push({
      file,
      sessionId,
      timestamp: Date.now()
    });

    // Trigger prediction after 5 accesses
    if (this.accessHistory.length >= 5) {
      await this.predictAndPreload(sessionId);
    }
  }

  private async predictAndPreload(sessionId: string): Promise<void> {
    // Get recent access sequence
    const recent = this.accessHistory.slice(-10);

    // Find similar patterns in history
    const similar = await this.model.searchPatterns(
      `file sequence: ${recent.map(a => a.file).join(' -> ')}`,
      { k: 10, minReward: 0.7 }
    );

    // Extract commonly accessed files after this pattern
    const predictions = this.extractPredictions(recent, similar);

    // Pre-load top predictions into cache
    for (const pred of predictions.slice(0, 3)) {
      await this.preloadFile(pred.file, pred.confidence);
    }
  }

  private async preloadFile(file: string, confidence: number): Promise<void> {
    // Read file and cache
    const content = await fs.promises.readFile(file, 'utf-8');

    // Store in AgentDB with high-priority cache
    await AgentDB.store({
      collection: 'preload-cache',
      key: file,
      data: { content, preloadedAt: Date.now() },
      ttl: 600000,  // 10 minutes
      priority: Math.round(confidence * 100)
    });
  }
}
```

### 9.2 Self-Improving Workers

```typescript
// Workers that learn from their outcomes
class SelfImprovingWorker extends BackgroundWorker {
  private trajectoryId: number;

  async run(): Promise<WorkerResults> {
    const rb = await ReasoningBank.connect();

    // Start trajectory for learning
    this.trajectoryId = await rb.trajectoryStart({
      task: `${this.trigger} ${this.topic}`,
      agent: this.constructor.name
    });

    try {
      const results = await super.run();

      // Record successful trajectory
      await rb.trajectoryEnd(this.trajectoryId, {
        success: results.status === 'complete',
        quality: this.assessQuality(results)
      });

      // Store pattern for future improvement
      await this.storePattern(results);

      return results;
    } catch (error) {
      // Record failed trajectory
      await rb.trajectoryEnd(this.trajectoryId, {
        success: false,
        quality: 0
      });

      throw error;
    }
  }

  private async storePattern(results: WorkerResults): Promise<void> {
    const rb = await ReasoningBank.connect();

    await rb.storePattern({
      sessionId: `worker:${this.id}`,
      task: `${this.trigger} ${this.topic}`,
      input: JSON.stringify({
        topic: this.topic,
        phases: this.phases
      }),
      output: JSON.stringify(results),
      reward: this.calculateReward(results),
      success: results.status === 'complete',
      latencyMs: Date.now() - this.startTime,
      critique: this.selfCritique(results)
    });
  }

  private selfCritique(results: WorkerResults): string {
    const critiques: string[] = [];

    // Analyze what could be improved
    if (results.completedPhases < this.phases.length) {
      critiques.push(`Only completed ${results.completedPhases}/${this.phases.length} phases`);
    }

    const duration = Date.now() - this.startTime;
    const expectedDuration = this.getExpectedDuration();
    if (duration > expectedDuration * 1.5) {
      critiques.push(`Took ${duration}ms, expected ${expectedDuration}ms`);
    }

    if (this.memoryDeposits < 5) {
      critiques.push('Low memory deposits - consider extracting more insights');
    }

    return critiques.join('. ') || 'Good execution';
  }
}
```

### 9.3 Federated Learning Across Sessions

```typescript
// Share learned patterns across different sessions
class FederatedLearner {
  private localPatterns: Pattern[] = [];
  private globalModel: ReasoningBank;

  async contributePattern(pattern: Pattern): Promise<void> {
    // Add to local buffer
    this.localPatterns.push(pattern);

    // Federate when we have enough
    if (this.localPatterns.length >= 10) {
      await this.federatePatterns();
    }
  }

  private async federatePatterns(): Promise<void> {
    const patterns = [...this.localPatterns];
    this.localPatterns = [];

    // Filter for high-quality patterns
    const highQuality = patterns.filter(p => p.reward >= 0.8);

    // Aggregate into global model
    for (const pattern of highQuality) {
      // Check for existing similar pattern
      const existing = await this.globalModel.searchPatterns(
        pattern.task,
        { k: 1, minReward: 0 }
      );

      if (existing.length > 0 && existing[0].similarity > 0.9) {
        // Merge with existing
        await this.mergePattern(existing[0], pattern);
      } else {
        // Add as new global pattern
        await this.globalModel.storePattern({
          ...pattern,
          sessionId: `global:${Date.now()}`
        });
      }
    }
  }

  private async mergePattern(
    existing: Pattern,
    newPattern: Pattern
  ): Promise<void> {
    // Weighted average of rewards
    const mergedReward = (existing.reward * 0.7 + newPattern.reward * 0.3);

    // Combine outputs
    const existingOutput = JSON.parse(existing.output);
    const newOutput = JSON.parse(newPattern.output);
    const mergedOutput = this.deepMerge(existingOutput, newOutput);

    await this.globalModel.updatePattern(existing.id, {
      reward: mergedReward,
      output: JSON.stringify(mergedOutput),
      updatedAt: Date.now()
    });
  }
}
```

---

## 10. Monitoring & Observability

### 10.1 Metrics Collection

```typescript
// Comprehensive metrics for workers
interface WorkerMetrics {
  // Execution metrics
  totalSpawned: number;
  totalCompleted: number;
  totalFailed: number;
  avgDurationMs: number;
  p95DurationMs: number;

  // Resource metrics
  peakConcurrency: number;
  avgMemoryMB: number;
  peakMemoryMB: number;

  // Learning metrics
  patternsStored: number;
  memoryDeposits: number;
  contextInjections: number;

  // Per-trigger breakdown
  byTrigger: Record<string, TriggerMetrics>;
}

class MetricsCollector {
  private metrics: WorkerMetrics;
  private db: AgentDB;

  async collect(timeframe: '1h' | '24h' | '7d'): Promise<WorkerMetrics> {
    const since = this.getTimestamp(timeframe);

    // Query worker registry
    const workers = await this.db.query({
      collection: 'background-workers',
      filter: { created_at: { $gte: since } }
    });

    // Aggregate metrics
    return {
      totalSpawned: workers.length,
      totalCompleted: workers.filter(w => w.status === 'complete').length,
      totalFailed: workers.filter(w => w.status === 'failed').length,
      avgDurationMs: this.calcAvg(workers.map(this.getDuration)),
      p95DurationMs: this.calcP95(workers.map(this.getDuration)),
      peakConcurrency: await this.getPeakConcurrency(since),
      avgMemoryMB: await this.getAvgMemory(workers),
      peakMemoryMB: await this.getPeakMemory(since),
      patternsStored: await this.countPatterns(since),
      memoryDeposits: await this.countDeposits(since),
      contextInjections: await this.countInjections(since),
      byTrigger: await this.aggregateByTrigger(workers)
    };
  }
}
```

### 10.2 Dashboard Display

```typescript
// Rich terminal dashboard
function displayWorkerDashboard(metrics: WorkerMetrics): void {
  console.log('╔═══════════════════════════════════════════════════╗');
  console.log('║           Background Workers Dashboard            ║');
  console.log('╠═══════════════════════════════════════════════════╣');
  console.log('║                                                   ║');
  console.log(`║  Spawned: ${metrics.totalSpawned.toString().padStart(6)}   Completed: ${metrics.totalCompleted.toString().padStart(6)}   ║`);
  console.log(`║  Failed:  ${metrics.totalFailed.toString().padStart(6)}   Active:    ${(metrics.totalSpawned - metrics.totalCompleted - metrics.totalFailed).toString().padStart(6)}   ║`);
  console.log('║                                                   ║');
  console.log('╠───────────────────────────────────────────────────╣');
  console.log('║  Performance                                      ║');
  console.log(`║  Avg Duration: ${(metrics.avgDurationMs / 1000).toFixed(1)}s    P95: ${(metrics.p95DurationMs / 1000).toFixed(1)}s          ║`);
  console.log(`║  Peak Concurrency: ${metrics.peakConcurrency}    Peak Memory: ${metrics.peakMemoryMB.toFixed(0)}MB   ║`);
  console.log('║                                                   ║');
  console.log('╠───────────────────────────────────────────────────╣');
  console.log('║  Learning                                         ║');
  console.log(`║  Patterns: ${metrics.patternsStored.toString().padStart(6)}   Deposits: ${metrics.memoryDeposits.toString().padStart(6)}       ║`);
  console.log(`║  Context Injections: ${metrics.contextInjections.toString().padStart(6)}                     ║`);
  console.log('║                                                   ║');
  console.log('╠───────────────────────────────────────────────────╣');
  console.log('║  By Trigger                                       ║');

  for (const [trigger, stats] of Object.entries(metrics.byTrigger)) {
    const bar = '█'.repeat(Math.round(stats.count / metrics.totalSpawned * 20));
    console.log(`║  ${trigger.padEnd(12)} ${bar.padEnd(20)} ${stats.count.toString().padStart(4)}   ║`);
  }

  console.log('║                                                   ║');
  console.log('╚═══════════════════════════════════════════════════╝');
}
```

### 10.3 Alerting

```typescript
// Alert on worker issues
class WorkerAlerter {
  private thresholds = {
    failureRate: 0.1,        // Alert if > 10% failures
    avgDurationMs: 300000,   // Alert if > 5 minutes avg
    memoryMB: 500            // Alert if > 500MB
  };

  async check(): Promise<Alert[]> {
    const metrics = await this.collector.collect('1h');
    const alerts: Alert[] = [];

    // Check failure rate
    const failureRate = metrics.totalFailed / metrics.totalSpawned;
    if (failureRate > this.thresholds.failureRate) {
      alerts.push({
        severity: 'warning',
        message: `High failure rate: ${(failureRate * 100).toFixed(1)}%`,
        metric: 'failureRate',
        value: failureRate
      });
    }

    // Check duration
    if (metrics.avgDurationMs > this.thresholds.avgDurationMs) {
      alerts.push({
        severity: 'warning',
        message: `Slow workers: ${(metrics.avgDurationMs / 1000).toFixed(0)}s avg`,
        metric: 'avgDuration',
        value: metrics.avgDurationMs
      });
    }

    // Check memory
    if (metrics.peakMemoryMB > this.thresholds.memoryMB) {
      alerts.push({
        severity: 'critical',
        message: `High memory: ${metrics.peakMemoryMB.toFixed(0)}MB`,
        metric: 'memory',
        value: metrics.peakMemoryMB
      });
    }

    return alerts;
  }
}
```

---

## Summary

This optimization plan provides a comprehensive framework for implementing non-blocking background workers that:

1. **Detect triggers** via UserPromptSubmit hooks with < 5ms latency
2. **Dispatch workers** using pre-warmed agent pools
3. **Execute in background** while user continues chatting
4. **Stream results** to AgentDB with HNSW indexing
5. **Surface context** automatically when relevant
6. **Learn continuously** using ReasoningBank patterns
7. **Self-improve** through trajectory tracking and reward learning

The architecture leverages existing infrastructure:
- **hooks.ts**: Trigger detection and dispatch
- **hooks-bridge.ts**: SDK integration
- **ReasoningBank**: Pattern learning and retrieval
- **AgentDB**: Vector storage with HNSW
- **SwarmLearningOptimizer**: Topology selection

Implementation follows 8 phases over ~8 weeks, with clear deliverables and testing at each stage.

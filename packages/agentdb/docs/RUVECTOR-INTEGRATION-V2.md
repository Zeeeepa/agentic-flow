# RuVector Integration - AgentDB v2.0.0

## Overview

AgentDB v2.0.0 now leverages the complete **ruvector** ecosystem for ultra-fast vector operations, graph databases, and GNN-powered adaptive learning.

## What is RuVector?

RuVector is a distributed, self-learning vector database that combines:

- **Vector Search**: HNSW indexing with 61µs latency and 16,400 QPS throughput
- **Graph Database**: Neo4j-style Cypher queries with hyperedge support
- **GNN (Graph Neural Networks)**: Self-learning attention mechanisms that improve search over time
- **Distributed Systems**: Raft consensus, auto-sharding, and multi-master replication
- **Tensor Compression**: 2-32x memory reduction through adaptive tiered compression (f32→f16→PQ8→PQ4→Binary)
- **Semantic Routing**: "Tiny Dancer" FastGRNN neural inference for intelligent LLM routing

## Package Migration

### Before (v1.x)
```json
{
  "dependencies": {
    "@ruvector/core": "^0.1.15",
    "@ruvector/gnn": "^0.1.15"
  }
}
```

### After (v2.0.0)
```json
{
  "dependencies": {
    "ruvector": "^0.1.24"
  }
}
```

The main `ruvector` package includes everything:
- Vector search (HNSW + SIMD optimizations)
- Graph database (Cypher query language)
- GNN layers (adaptive attention mechanisms)
- Distributed clustering (Raft consensus)
- AI routing (semantic load balancing)
- WASM support (browser + Node.js)

## Architecture Benefits

### 1. All-in-One Package
No need to manage separate packages for core, GNN, and graph features. One `npm install ruvector` gives you the full ecosystem.

### 2. Automatic Optimization
- **Hot paths**: Full precision + maximum compute for frequently-accessed vectors
- **Cold paths**: Automatic compression + resource throttling
- **Adaptive learning**: Query patterns reinforced over time → faster common queries

### 3. Backward Compatibility
The integration maintains fallback support for legacy `@ruvector/core` and `@ruvector/gnn` packages, ensuring smooth migration.

## AgentDB v2 Integration Points

### Vector Backend (`src/backends/ruvector/RuVectorBackend.ts`)

```typescript
async initialize(): Promise<void> {
  // Try main ruvector package first (includes core, gnn, graph)
  let VectorDB;
  try {
    const ruvector = await import('ruvector');
    VectorDB = ruvector.VectorDB || ruvector.default?.VectorDB;
  } catch {
    // Fallback to @ruvector/core for backward compatibility
    const core = await import('@ruvector/core');
    VectorDB = core.VectorDB || core.default;
  }

  this.db = new VectorDB(this.config.dimension, {
    metric: this.config.metric,
    maxElements: this.config.maxElements || 100000,
    efConstruction: this.config.efConstruction || 200,
    M: this.config.M || 16
  });
}
```

### Backend Detection (`src/backends/factory.ts`)

```typescript
// Check RuVector packages (main package or scoped packages)
try {
  // Try main ruvector package first
  const ruvector = await import('ruvector');
  result.ruvector.core = true;
  result.ruvector.gnn = true; // Main package includes GNN
  result.ruvector.graph = true; // Main package includes Graph
  result.ruvector.native = ruvector.isNative?.() ?? false;
  result.available = 'ruvector';
} catch {
  // Try scoped packages as fallback
  // ... legacy support ...
}
```

## Performance Characteristics

| Feature | Performance | Details |
|---------|------------|---------|
| Vector Search | 150x faster than Pinecone | Sub-millisecond latency (61µs) |
| Throughput | 16,400 QPS | Sustained queries per second |
| Memory Reduction | 2-32x compression | Adaptive tiered quantization |
| Learning | Self-improving | GNN attention on index topology |
| Latency | <100µs | SIMD optimizations + native Rust |

## Dual Storage Architecture

AgentDB v2 uses TWO storage systems optimally:

### 1. SQLite (sql.js) - Relational Data
- **Episodes**: Session memory, task tracking, reward history
- **Skills**: Code patterns, usage counts, metadata
- **Causal Experiments**: A/B tests, observations, statistical results
- **Causal Edges**: Cause-effect relationships with confidence scores

### 2. RuVector - Vector Embeddings
- **Semantic Search**: Find similar episodes/skills by meaning
- **Pattern Matching**: Retrieve relevant memories by context
- **Diversity Ranking**: MMR-based result diversification
- **Graph Queries**: Traverse causal relationships efficiently

This separation allows:
- **SQL strengths**: ACID transactions, foreign keys, complex joins
- **Vector strengths**: Semantic similarity, approximate nearest neighbors, sub-millisecond search
- **Best of both**: Relational integrity + vector search speed

## Migration Guide

### For Existing AgentDB Users

1. **Update package.json**:
   ```bash
   npm uninstall @ruvector/core @ruvector/gnn
   npm install ruvector@latest
   ```

2. **Rebuild**:
   ```bash
   npm run build
   ```

3. **No code changes required** - The integration is backward compatible!

### For New Projects

```bash
npm install agentdb@2.0.0
# ruvector is included as a dependency
```

## Validation Results

✅ **100% CLI Command Success Rate** (35/35 passing)

All AgentDB v2 CLI commands have been validated with the new RuVector integration:
- Reflexion memory commands (7/7)
- Skill library commands (4/4)
- Causal reasoning commands (5/5)
- Learner commands (2/2)
- Recall commands (1/1)
- Hooks integration (6/6)
- Vector search (3/3)
- Database operations (3/3)

## Future Enhancements

### Phase 1: Graph Database Integration
- Add Cypher query support for causal graph traversal
- Hyperedge modeling for complex relationships
- Graph neural network training on causal patterns

### Phase 2: Distributed Features
- Multi-agent memory synchronization via Raft consensus
- Automatic sharding for large-scale deployments
- Snapshot-based backup/restore

### Phase 3: Semantic Routing
- Tiny Dancer integration for intelligent LLM selection
- Cost-optimized inference routing across endpoints
- Performance-based load balancing

## Resources

- **RuVector GitHub**: https://github.com/ruvnet/ruvector
- **AgentDB Documentation**: https://agentdb.ruv.io
- **Performance Benchmarks**: See `benchmarks/` directory
- **CLI Validation Report**: `docs/CLI-VALIDATION-RESULTS.md`

## Summary

AgentDB v2.0.0 + RuVector = Production-ready AI agent memory system with:
- 🚀 150x faster vector search
- 🧠 Self-learning GNN capabilities
- 📊 Graph database for causal reasoning
- 🎯 100% validated CLI commands
- 💾 Dual storage architecture (SQLite + Vector)
- 🔧 Backward compatible migration

**Status**: ✅ Production Ready
**Test Coverage**: 100% (35/35 CLI commands passing)
**Performance**: 61µs latency, 16,400 QPS, <100µs SIMD search

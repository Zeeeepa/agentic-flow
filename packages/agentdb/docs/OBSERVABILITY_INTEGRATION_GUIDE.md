# AgentDB Observability Integration Guide

This guide shows how to integrate OpenTelemetry observability into AgentDB
components.

## Quick Start

### 1. Import Telemetry Tools

```typescript
import {
  traced,
  recordMetric,
  withTelemetry,
  withBatchTelemetry,
  recordCacheAccess,
  recordErrorWithContext,
} from '../observability';
```

### 2. Add Decorators to Methods

```typescript
class MyController {
  @traced('my-controller.operation', {
    recordMetrics: true,
    attributes: { component: 'my-controller' },
  })
  async myOperation(param: string): Promise<Result> {
    // Method is automatically traced
    return result;
  }
}
```

### 3. Use Telemetry Wrappers

```typescript
// For database operations
await withTelemetry('query_episodes', 'episodes', async () => {
  return await this.db.query('SELECT * FROM episodes');
});

// For batch operations
await withBatchTelemetry('batch_insert', 'episodes', items.length, async () => {
  return await this.insertBatch(items);
});
```

### 4. Record Custom Metrics

```typescript
// Record cache access
recordCacheAccess(key, hit);

// Record custom operation
recordMetric('operation', {
  operationType: 'consolidation',
  tableName: 'skills',
  resultSize: results.length,
});

// Record error with context
try {
  await operation();
} catch (error) {
  recordErrorWithContext(error as Error, 'operation-name', {
    context: 'additional-info',
  });
  throw error;
}
```

## Integration Patterns

### Pattern 1: Controller Methods

Use the `@traced` decorator for high-level controller methods:

```typescript
@traced('reflexion.store-episode', {
  recordMetrics: true,
  attributes: { component: 'reflexion-memory' }
})
async storeEpisode(episode: Episode): Promise<number> {
  // Implementation
}
```

**Benefits:**

- Automatic span creation
- Execution time tracking
- Error capture with stack traces
- Metric recording

### Pattern 2: Database Operations

Use `withTelemetry` for database queries:

```typescript
async fetchData(): Promise<Data[]> {
  return withTelemetry('fetch_data', 'my_table', async () => {
    const stmt = this.db.prepare('SELECT * FROM my_table');
    return stmt.all();
  });
}
```

**Benefits:**

- Query latency tracking
- Operation success/failure metrics
- Distributed tracing support

### Pattern 3: Batch Operations

Use `withBatchTelemetry` for bulk operations:

```typescript
async batchInsert(items: Item[]): Promise<void> {
  await withBatchTelemetry('insert', 'items', items.length, async () => {
    const transaction = this.db.transaction(() => {
      for (const item of items) {
        this.insertStmt.run(item);
      }
    });
    transaction();
  });
}
```

**Benefits:**

- Batch size tracking
- Throughput calculation
- Progress monitoring

### Pattern 4: Cache Operations

Use `recordCacheAccess` for cache hits/misses:

```typescript
get(key: string): Value | undefined {
  const value = this.cache.get(key);
  recordCacheAccess(key, value !== undefined);
  return value;
}
```

**Benefits:**

- Cache hit rate monitoring
- Cache efficiency analysis
- Automatic categorization

### Pattern 5: Error Handling

Use `recordErrorWithContext` for detailed error tracking:

```typescript
try {
  await operation();
} catch (error) {
  recordErrorWithContext(error as Error, 'operation_name', {
    userId: user.id,
    attemptNumber: retryCount,
    context: 'additional_debug_info',
  });
  throw error;
}
```

**Benefits:**

- Error categorization
- Contextual debugging information
- Error rate tracking

## Component-Specific Integration

### ReflexionMemory

**Methods to instrument:**

- `storeEpisode()` - Episode creation
- `retrieveRelevant()` - Episode retrieval
- `getCritiqueSummary()` - Critique aggregation
- `getSuccessStrategies()` - Strategy retrieval
- `getTaskStats()` - Statistics calculation

**Example:**

```typescript
@traced('reflexion.store-episode', { recordMetrics: true })
async storeEpisode(episode: Episode): Promise<number> {
  return withTelemetry('store_episode', 'episodes', async () => {
    // Implementation
  });
}
```

### SkillLibrary

**Methods to instrument:**

- `createSkill()` - Skill creation
- `retrieveSkills()` - Skill search
- `updateSkillStats()` - Statistics update
- `consolidateEpisodesIntoSkills()` - Pattern consolidation

**Example:**

```typescript
@traced('skills.create-skill', { recordMetrics: true })
async createSkill(skill: Skill): Promise<number> {
  return withTelemetry('create_skill', 'skills', async () => {
    // Implementation
  });
}
```

### BatchOperations

**Methods to instrument:**

- `insertEpisodes()` - Bulk episode insert
- `insertSkills()` - Bulk skill insert
- `batchInsertParallel()` - Parallel batch insert
- `pruneData()` - Data cleanup

**Example:**

```typescript
@traced('batch.insert-episodes', { recordMetrics: true })
async insertEpisodes(episodes: Episode[]): Promise<number> {
  return withBatchTelemetry('insert', 'episodes', episodes.length, async () => {
    // Implementation
  });
}
```

### QueryCache

**Methods to instrument:**

- `get()` - Cache retrieval
- `set()` - Cache storage
- `invalidateCategory()` - Cache invalidation
- `pruneExpired()` - Expiration cleanup

**Example:**

```typescript
get<T>(key: string): T | undefined {
  const entry = this.cache.get(key);
  recordCacheAccess(key, entry !== undefined);
  // Implementation
}
```

## Best Practices

### 1. Granularity

- ✅ Instrument at method/operation level
- ❌ Don't instrument every line of code
- ✅ Focus on user-facing operations
- ❌ Don't over-instrument internal helpers

### 2. Naming Conventions

Use consistent naming for operations:

- Format: `component.operation`
- Examples: `reflexion.store-episode`, `skills.retrieve-skills`
- Use kebab-case for readability

### 3. Attributes

Add meaningful attributes to spans:

```typescript
@traced('operation', {
  attributes: {
    component: 'reflexion-memory',
    version: '2.0.0',
    backend: 'sqlite'
  }
})
```

### 4. Error Handling

Always record errors with context:

```typescript
catch (error) {
  recordErrorWithContext(
    error as Error,
    'operation_name',
    { user: userId, attempt: retryCount }
  );
  throw error;
}
```

### 5. Performance

- Use `recordMetrics: true` only for critical operations
- Batch metric collection when possible
- Set appropriate sampling rates in production

### 6. Testing

Disable telemetry in tests:

```typescript
// In test setup
telemetry.setEnabled(false);
```

## Metrics Checklist

For each component, ensure these metrics are recorded:

- [ ] Query latency (all database operations)
- [ ] Cache hit rate (all cache operations)
- [ ] Error rate (all error paths)
- [ ] Operation throughput (batch operations)
- [ ] Result size (all queries)

## Verification

After integration, verify telemetry:

1. **Start observability stack:**

   ```bash
   cd examples
   docker-compose -f docker-compose.observability.yml up -d
   ```

2. **Run operations:**

   ```typescript
   const memory = new ReflexionMemory(db, embedder);
   await memory.storeEpisode(testEpisode);
   ```

3. **Check Jaeger:**
   - Open http://localhost:16686
   - Select service: `agentdb`
   - View traces

4. **Check Prometheus:**
   - Open http://localhost:9090
   - Query: `agentdb_query_latency_bucket`
   - Verify metrics

5. **Check Grafana:**
   - Open http://localhost:3000 (admin/admin)
   - Import dashboard from `examples/grafana-dashboard.json`
   - Verify visualizations

## Troubleshooting

### No traces appearing

1. Check telemetry is enabled:

   ```typescript
   console.log(telemetry.isEnabled()); // Should be true
   ```

2. Verify collector is running:

   ```bash
   curl http://localhost:13133/health
   ```

3. Check console for errors:
   ```typescript
   telemetry.initialize().catch(console.error);
   ```

### High overhead

1. Disable metrics recording:

   ```typescript
   @traced('operation') // Remove { recordMetrics: true }
   ```

2. Reduce sampling rate:

   ```typescript
   TelemetryManager.getInstance({ samplingRate: 0.1 }); // 10%
   ```

3. Increase export interval:
   ```typescript
   // In otel-collector-config.yaml
   exportIntervalMillis: 30000 # 30 seconds
   ```

## Next Steps

1. Review [OBSERVABILITY.md](./OBSERVABILITY.md) for full documentation
2. Check example integrations in `examples/telemetry-integration-*.ts`
3. Customize collector config for your infrastructure
4. Set up alerting rules in Prometheus
5. Create custom Grafana dashboards

## Support

- GitHub Issues: https://github.com/ruvnet/agentic-flow/issues
- Documentation: https://github.com/ruvnet/agentic-flow/docs

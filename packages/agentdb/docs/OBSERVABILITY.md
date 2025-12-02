# AgentDB Observability

Comprehensive OpenTelemetry-based observability for production monitoring.

## Features

- **Distributed Tracing**: Track database operations across your application
- **Metrics Collection**: Query latency, cache hit rates, error rates,
  throughput
- **Graceful Degradation**: Zero impact when disabled or collector unavailable
- **Production Ready**: Optimized for low overhead and high performance
- **Multiple Exporters**: Support for Prometheus, Jaeger, OTLP, and console

## Quick Start

### 1. Installation

The observability module requires OpenTelemetry dependencies:

```bash
npm install @opentelemetry/api \
  @opentelemetry/sdk-node \
  @opentelemetry/resources \
  @opentelemetry/semantic-conventions \
  @opentelemetry/exporter-trace-otlp-http \
  @opentelemetry/exporter-metrics-otlp-http \
  @opentelemetry/exporter-prometheus \
  @opentelemetry/sdk-trace-base \
  @opentelemetry/sdk-metrics \
  @opentelemetry/auto-instrumentations-node
```

### 2. Basic Configuration

```typescript
import { TelemetryManager } from 'agentdb/observability';

// Initialize telemetry
const telemetry = TelemetryManager.getInstance({
  enabled: true,
  serviceName: 'my-app',
  serviceVersion: '1.0.0',
  otlpTraceEndpoint: 'http://localhost:4318/v1/traces',
  otlpMetricsEndpoint: 'http://localhost:4318/v1/metrics',
  prometheusEnabled: true,
  prometheusPort: 9464,
  samplingRate: 1.0,
});

await telemetry.initialize();
```

### 3. Using the @traced Decorator

```typescript
import { traced } from 'agentdb/observability';

class MyService {
  @traced('my-service.operation', { recordMetrics: true })
  async myOperation(param: string): Promise<Result> {
    // Your code here
    return result;
  }
}
```

### 4. Manual Instrumentation

```typescript
import { withSpan, recordMetric } from 'agentdb/observability';

async function myFunction() {
  return withSpan(
    'my-function',
    async (span) => {
      span?.setAttribute('custom.attribute', 'value');

      const result = await doWork();

      recordMetric('operation', {
        operationType: 'custom-operation',
        resultSize: result.length,
      });

      return result;
    },
    { component: 'my-component' }
  );
}
```

## Configuration Options

### TelemetryConfig

```typescript
interface TelemetryConfig {
  enabled?: boolean; // Enable/disable telemetry
  serviceName?: string; // Service name
  serviceVersion?: string; // Service version
  otlpTraceEndpoint?: string; // OTLP traces endpoint
  otlpMetricsEndpoint?: string; // OTLP metrics endpoint
  prometheusEnabled?: boolean; // Enable Prometheus exporter
  prometheusPort?: number; // Prometheus port
  consoleEnabled?: boolean; // Enable console exporters
  samplingRate?: number; // Sampling rate (0.0-1.0)
  autoInstrumentation?: boolean; // Auto-instrument Node.js
  resourceAttributes?: Record<string, string>; // Custom attributes
}
```

### Environment Variables

```bash
# Enable telemetry (default: production only)
NODE_ENV=production

# OTLP endpoints
OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://localhost:4318/v1/traces
OTEL_EXPORTER_OTLP_METRICS_ENDPOINT=http://localhost:4318/v1/metrics

# Service information
OTEL_SERVICE_NAME=agentdb
OTEL_SERVICE_VERSION=2.0.0-alpha
```

## Metrics

### Query Latency

- **Name**: `agentdb.query.latency`
- **Type**: Histogram
- **Unit**: milliseconds
- **Attributes**: `operation_type`, `table_name`, `success`

### Cache Hit Rate

- **Name**: `agentdb.cache.hit_rate`
- **Type**: Observable Gauge
- **Unit**: percentage
- **Description**: Percentage of cache hits vs total accesses

### Cache Hits

- **Name**: `agentdb.cache.hits`
- **Type**: Counter
- **Attributes**: `key_type`

### Cache Misses

- **Name**: `agentdb.cache.misses`
- **Type**: Counter
- **Attributes**: `key_type`

### Error Rate

- **Name**: `agentdb.errors`
- **Type**: Counter
- **Attributes**: `error_type`, `operation`, `message`

### Operation Count

- **Name**: `agentdb.operations`
- **Type**: Counter
- **Attributes**: `operation_type`, `table_name`, `result_size`

### Throughput

- **Name**: `agentdb.throughput`
- **Type**: Counter
- **Unit**: operations
- **Attributes**: `operation_type`

## Tracing

### Automatic Tracing with @traced

The `@traced` decorator automatically:

- Creates spans for method execution
- Records execution time
- Captures errors with stack traces
- Adds result size attributes
- Records metrics (optional)

```typescript
@traced('operation-name', {
  attributes: { custom: 'value' },
  recordMetrics: true
})
async myMethod() {
  // Automatically traced
}
```

### Manual Spans

```typescript
import { withSpan } from 'agentdb/observability';

const result = await withSpan(
  'my-operation',
  async (span) => {
    // Add custom attributes
    span?.setAttribute('user.id', userId);
    span?.setAttribute('query.type', 'vector-search');

    // Do work
    const data = await fetchData();

    // Record span events
    span?.addEvent('data-fetched', {
      count: data.length,
    });

    return data;
  },
  {
    // Initial attributes
    component: 'data-layer',
    version: '1.0.0',
  }
);
```

## Integration Examples

### ReflexionMemory Integration

```typescript
import { traced, recordMetric } from 'agentdb/observability';

class ReflexionMemory {
  @traced('reflexion.store-episode', { recordMetrics: true })
  async storeEpisode(episode: Episode): Promise<void> {
    // Method is automatically traced
    await this.db.insert('episodes', episode);
  }

  @traced('reflexion.search', { recordMetrics: true })
  async search(query: string, k: number): Promise<Episode[]> {
    const results = await this.db.vectorSearch('episodes', query, k);
    return results;
  }
}
```

### SkillLibrary Integration

```typescript
class SkillLibrary {
  @traced('skills.add', { recordMetrics: true })
  async addSkill(skill: Skill): Promise<void> {
    await this.db.insert('skills', skill);
  }

  @traced('skills.retrieve', { recordMetrics: true })
  async getSkill(id: string): Promise<Skill | null> {
    return this.db.query('skills', { id }).first();
  }
}
```

### QueryCache Integration

```typescript
import { recordCacheAccess } from 'agentdb/observability';

class QueryCache {
  async get(key: string): Promise<any> {
    const value = this.cache.get(key);

    // Record cache access
    recordCacheAccess(key, value !== undefined);

    return value;
  }
}
```

### BatchOperations Integration

```typescript
import { withBatchTelemetry } from 'agentdb/observability';

class BatchOperations {
  async batchInsert(items: any[]): Promise<void> {
    await withBatchTelemetry('insert', 'episodes', items.length, async () => {
      await this.db.batchInsert('episodes', items);
    });
  }
}
```

## Observability Stack Setup

### Using Docker Compose

```bash
# Start the full observability stack
cd examples
docker-compose -f docker-compose.observability.yml up -d

# Access services:
# - Grafana: http://localhost:3000 (admin/admin)
# - Prometheus: http://localhost:9090
# - Jaeger UI: http://localhost:16686
# - OTEL Collector: http://localhost:13133/health
```

### Manual Setup

#### 1. Start OpenTelemetry Collector

```bash
docker run -d \
  -p 4317:4317 \
  -p 4318:4318 \
  -p 8888:8888 \
  -v $(pwd)/otel-collector-config.yaml:/etc/otel-collector-config.yaml \
  otel/opentelemetry-collector-contrib:latest \
  --config=/etc/otel-collector-config.yaml
```

#### 2. Start Prometheus

```bash
docker run -d \
  -p 9090:9090 \
  -v $(pwd)/prometheus.yml:/etc/prometheus/prometheus.yml \
  prom/prometheus:latest
```

#### 3. Start Jaeger

```bash
docker run -d \
  -p 16686:16686 \
  -p 14250:14250 \
  -e COLLECTOR_OTLP_ENABLED=true \
  jaegertracing/all-in-one:latest
```

#### 4. Start Grafana

```bash
docker run -d \
  -p 3000:3000 \
  -e GF_SECURITY_ADMIN_PASSWORD=admin \
  grafana/grafana:latest
```

## Grafana Dashboard

Import the pre-built dashboard from `examples/grafana-dashboard.json` to
visualize:

- Query latency percentiles (p95, p99)
- Cache hit rate gauge
- Error rate by type
- Operations throughput
- Cache statistics
- Query latency heatmap by table

## Performance Impact

The telemetry system is designed for minimal performance impact:

- **Disabled Mode**: Zero overhead (stubs only)
- **Enabled Mode**: <1% CPU overhead, <10MB memory overhead
- **Sampling**: Configurable sampling rate for high-volume systems
- **Async Exports**: Non-blocking metric and trace exports
- **Graceful Degradation**: Continues operation if collector unavailable

## Best Practices

### 1. Use Appropriate Sampling

For high-traffic systems, use sampling to reduce overhead:

```typescript
TelemetryManager.getInstance({
  samplingRate: 0.1, // Sample 10% of traces
});
```

### 2. Add Context to Spans

```typescript
await withSpan('operation', async (span) => {
  span?.setAttribute('user.id', userId);
  span?.setAttribute('request.id', requestId);
  span?.setAttribute('session.id', sessionId);
  // ... operation code
});
```

### 3. Record Custom Metrics

```typescript
recordMetric('operation', {
  operationType: 'custom-operation',
  tableName: 'episodes',
  resultSize: results.length,
});
```

### 4. Handle Errors Properly

```typescript
try {
  await operation();
} catch (error) {
  recordErrorWithContext(error as Error, 'operation-name', {
    context: 'additional-info',
  });
  throw error;
}
```

## Troubleshooting

### Telemetry Not Working

1. Check if telemetry is enabled:

```typescript
const telemetry = TelemetryManager.getInstance();
console.log('Enabled:', telemetry.isEnabled());
```

2. Verify collector is reachable:

```bash
curl http://localhost:13133/health
```

3. Check console output for errors:

```bash
# Should see initialization message
[AgentDB] Telemetry initialized successfully
```

### High Memory Usage

1. Enable sampling for traces
2. Reduce metric export interval
3. Limit span attributes size
4. Use memory limiter in collector config

### Missing Metrics

1. Verify Prometheus scrape targets
2. Check collector pipeline configuration
3. Ensure metrics are being recorded
4. Verify exporter endpoints

## Security Considerations

1. **Sensitive Data**: Avoid adding sensitive data to span attributes
2. **Network Security**: Use TLS for production OTLP endpoints
3. **Access Control**: Secure Grafana/Prometheus/Jaeger with authentication
4. **Data Retention**: Configure appropriate retention policies

## Roadmap

- [ ] Custom dashboard templates for common use cases
- [ ] Alerting rules for critical metrics
- [ ] Distributed tracing across microservices
- [ ] Log correlation with traces
- [ ] Performance profiling integration
- [ ] Custom metrics for ReasoningBank patterns
- [ ] Real-time anomaly detection

## Support

For issues or questions:

- GitHub Issues: https://github.com/ruvnet/agentic-flow/issues
- Documentation: https://github.com/ruvnet/agentic-flow/docs

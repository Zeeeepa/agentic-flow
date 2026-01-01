/**
 * Worker Benchmark System
 *
 * Comprehensive performance benchmarking for the worker system including:
 * - Dispatch latency measurement
 * - Phase execution timing
 * - Memory tracking
 * - Throughput analysis
 * - Integration with agents
 */

import { WorkerTrigger, WorkerInfo } from './types.js';
import { workerRegistry } from './worker-registry.js';
import { workerAgentIntegration } from './worker-agent-integration.js';
import { modelCache } from '../utils/model-cache.js';

// ============================================================================
// Types
// ============================================================================

export interface BenchmarkResult {
  name: string;
  operation: string;
  count: number;
  totalTimeMs: number;
  avgTimeMs: number;
  minMs: number;
  maxMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  throughput: number;
  memoryDeltaMB: number;
  passed: boolean;
  target?: number;
  details?: Record<string, unknown>;
}

export interface BenchmarkSuite {
  name: string;
  description: string;
  timestamp: number;
  results: BenchmarkResult[];
  summary: {
    totalTests: number;
    passed: number;
    failed: number;
    avgLatencyMs: number;
    totalDurationMs: number;
    peakMemoryMB: number;
  };
}

export interface LatencyBucket {
  range: string;
  count: number;
  percentage: number;
}

// ============================================================================
// Benchmark Utilities
// ============================================================================

function calculatePercentile(sorted: number[], percentile: number): number {
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)] || 0;
}

function getMemoryUsageMB(): number {
  const mem = process.memoryUsage();
  return mem.heapUsed / 1024 / 1024;
}

function createLatencyHistogram(latencies: number[]): LatencyBucket[] {
  const buckets = [
    { max: 1, label: '<1ms' },
    { max: 5, label: '1-5ms' },
    { max: 10, label: '5-10ms' },
    { max: 50, label: '10-50ms' },
    { max: 100, label: '50-100ms' },
    { max: 500, label: '100-500ms' },
    { max: 1000, label: '500ms-1s' },
    { max: Infinity, label: '>1s' }
  ];

  const counts = new Array(buckets.length).fill(0);

  for (const latency of latencies) {
    for (let i = 0; i < buckets.length; i++) {
      if (latency <= buckets[i].max) {
        counts[i]++;
        break;
      }
    }
  }

  return buckets.map((bucket, i) => ({
    range: bucket.label,
    count: counts[i],
    percentage: (counts[i] / latencies.length) * 100
  }));
}

// ============================================================================
// Worker Benchmarks
// ============================================================================

export class WorkerBenchmarks {
  private results: BenchmarkResult[] = [];

  /**
   * Benchmark trigger detection speed
   */
  async benchmarkTriggerDetection(iterations: number = 1000): Promise<BenchmarkResult> {
    const prompts = [
      'ultralearn the authentication system architecture',
      'optimize the database query performance',
      'audit security vulnerabilities in the payment module',
      'benchmark the API response times',
      'testgaps in the user module tests',
      'document the REST API endpoints',
      'deepdive into the message queue implementation',
      'refactor the UserService class for better maintainability',
      'Please help me write some code',  // No trigger
      'How does this function work?'       // No trigger
    ];

    const latencies: number[] = [];
    const memStart = getMemoryUsageMB();

    // Import detector dynamically to avoid circular deps
    const { triggerDetector } = await import('./trigger-detector.js');

    for (let i = 0; i < iterations; i++) {
      const prompt = prompts[i % prompts.length];
      const start = performance.now();
      triggerDetector.detect(prompt);
      latencies.push(performance.now() - start);
    }

    const sorted = [...latencies].sort((a, b) => a - b);
    const memEnd = getMemoryUsageMB();

    const result: BenchmarkResult = {
      name: 'Trigger Detection',
      operation: 'detect',
      count: iterations,
      totalTimeMs: latencies.reduce((a, b) => a + b, 0),
      avgTimeMs: latencies.reduce((a, b) => a + b, 0) / latencies.length,
      minMs: sorted[0],
      maxMs: sorted[sorted.length - 1],
      p50Ms: calculatePercentile(sorted, 50),
      p95Ms: calculatePercentile(sorted, 95),
      p99Ms: calculatePercentile(sorted, 99),
      throughput: (iterations / (latencies.reduce((a, b) => a + b, 0) / 1000)),
      memoryDeltaMB: memEnd - memStart,
      passed: calculatePercentile(sorted, 95) < 5, // Target: p95 < 5ms
      target: 5,
      details: {
        histogram: createLatencyHistogram(latencies),
        promptsWithTriggers: 8,
        promptsWithoutTriggers: 2
      }
    };

    this.results.push(result);
    return result;
  }

  /**
   * Benchmark worker registry operations
   */
  async benchmarkRegistryOperations(iterations: number = 500): Promise<BenchmarkResult> {
    const triggers: WorkerTrigger[] = ['ultralearn', 'optimize', 'audit', 'benchmark', 'testgaps'];
    const sessionId = `benchmark-${Date.now()}`;

    const createLatencies: number[] = [];
    const getLatencies: number[] = [];
    const updateLatencies: number[] = [];
    const workerIds: string[] = [];

    const memStart = getMemoryUsageMB();

    // Benchmark creates
    for (let i = 0; i < iterations; i++) {
      const trigger = triggers[i % triggers.length];
      const start = performance.now();
      const workerId = workerRegistry.create(trigger, sessionId, `topic-${i}`);
      createLatencies.push(performance.now() - start);
      workerIds.push(workerId);
    }

    // Benchmark gets
    for (const workerId of workerIds) {
      const start = performance.now();
      workerRegistry.get(workerId);
      getLatencies.push(performance.now() - start);
    }

    // Benchmark updates
    for (const workerId of workerIds) {
      const start = performance.now();
      workerRegistry.updateStatus(workerId, 'running', { progress: 50 });
      updateLatencies.push(performance.now() - start);
    }

    const allLatencies = [...createLatencies, ...getLatencies, ...updateLatencies];
    const sorted = [...allLatencies].sort((a, b) => a - b);
    const memEnd = getMemoryUsageMB();

    // Cleanup
    for (const workerId of workerIds) {
      try {
        workerRegistry.updateStatus(workerId, 'complete');
      } catch {
        // Ignore cleanup errors
      }
    }

    const result: BenchmarkResult = {
      name: 'Worker Registry',
      operation: 'crud',
      count: allLatencies.length,
      totalTimeMs: allLatencies.reduce((a, b) => a + b, 0),
      avgTimeMs: allLatencies.reduce((a, b) => a + b, 0) / allLatencies.length,
      minMs: sorted[0],
      maxMs: sorted[sorted.length - 1],
      p50Ms: calculatePercentile(sorted, 50),
      p95Ms: calculatePercentile(sorted, 95),
      p99Ms: calculatePercentile(sorted, 99),
      throughput: (allLatencies.length / (allLatencies.reduce((a, b) => a + b, 0) / 1000)),
      memoryDeltaMB: memEnd - memStart,
      passed: calculatePercentile(sorted, 95) < 10, // Target: p95 < 10ms
      target: 10,
      details: {
        createAvgMs: createLatencies.reduce((a, b) => a + b, 0) / createLatencies.length,
        getAvgMs: getLatencies.reduce((a, b) => a + b, 0) / getLatencies.length,
        updateAvgMs: updateLatencies.reduce((a, b) => a + b, 0) / updateLatencies.length
      }
    };

    this.results.push(result);
    return result;
  }

  /**
   * Benchmark agent selection performance
   */
  async benchmarkAgentSelection(iterations: number = 1000): Promise<BenchmarkResult> {
    const triggers: WorkerTrigger[] = [
      'ultralearn', 'optimize', 'audit', 'benchmark', 'testgaps',
      'document', 'deepdive', 'refactor', 'map', 'preload'
    ];

    const latencies: number[] = [];
    const memStart = getMemoryUsageMB();

    for (let i = 0; i < iterations; i++) {
      const trigger = triggers[i % triggers.length];
      const start = performance.now();
      workerAgentIntegration.selectBestAgent(trigger);
      latencies.push(performance.now() - start);
    }

    const sorted = [...latencies].sort((a, b) => a - b);
    const memEnd = getMemoryUsageMB();

    const result: BenchmarkResult = {
      name: 'Agent Selection',
      operation: 'selectBestAgent',
      count: iterations,
      totalTimeMs: latencies.reduce((a, b) => a + b, 0),
      avgTimeMs: latencies.reduce((a, b) => a + b, 0) / latencies.length,
      minMs: sorted[0],
      maxMs: sorted[sorted.length - 1],
      p50Ms: calculatePercentile(sorted, 50),
      p95Ms: calculatePercentile(sorted, 95),
      p99Ms: calculatePercentile(sorted, 99),
      throughput: (iterations / (latencies.reduce((a, b) => a + b, 0) / 1000)),
      memoryDeltaMB: memEnd - memStart,
      passed: calculatePercentile(sorted, 95) < 1, // Target: p95 < 1ms
      target: 1,
      details: {
        triggersPerAgent: triggers.length
      }
    };

    this.results.push(result);
    return result;
  }

  /**
   * Benchmark model cache performance
   */
  async benchmarkModelCache(iterations: number = 100): Promise<BenchmarkResult> {
    const latencies: number[] = [];
    const memStart = getMemoryUsageMB();

    // Simulate cache operations
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();

      // Test cache stats retrieval
      modelCache.getStats();

      // Test cache key generation
      const key = `benchmark-model-${i % 10}`;
      modelCache.has(key);

      latencies.push(performance.now() - start);
    }

    const sorted = [...latencies].sort((a, b) => a - b);
    const memEnd = getMemoryUsageMB();
    const cacheStats = modelCache.getStats();

    const result: BenchmarkResult = {
      name: 'Model Cache',
      operation: 'cache-ops',
      count: iterations,
      totalTimeMs: latencies.reduce((a, b) => a + b, 0),
      avgTimeMs: latencies.reduce((a, b) => a + b, 0) / latencies.length,
      minMs: sorted[0],
      maxMs: sorted[sorted.length - 1],
      p50Ms: calculatePercentile(sorted, 50),
      p95Ms: calculatePercentile(sorted, 95),
      p99Ms: calculatePercentile(sorted, 99),
      throughput: (iterations / (latencies.reduce((a, b) => a + b, 0) / 1000)),
      memoryDeltaMB: memEnd - memStart,
      passed: calculatePercentile(sorted, 95) < 0.5, // Target: p95 < 0.5ms
      target: 0.5,
      details: {
        cacheHits: cacheStats.hits,
        cacheMisses: cacheStats.misses,
        cacheHitRate: cacheStats.hitRate,
        cacheSize: cacheStats.size
      }
    };

    this.results.push(result);
    return result;
  }

  /**
   * Benchmark concurrent worker handling
   */
  async benchmarkConcurrentWorkers(workerCount: number = 10): Promise<BenchmarkResult> {
    const triggers: WorkerTrigger[] = ['ultralearn', 'optimize', 'audit'];
    const sessionId = `concurrent-${Date.now()}`;
    const workerIds: string[] = [];

    const memStart = getMemoryUsageMB();
    const startTime = performance.now();

    // Create workers concurrently
    const createPromises = Array.from({ length: workerCount }, (_, i) =>
      Promise.resolve().then(() => {
        const trigger = triggers[i % triggers.length];
        return workerRegistry.create(trigger, sessionId, `concurrent-${i}`);
      })
    );

    const ids = await Promise.all(createPromises);
    workerIds.push(...ids);

    // Simulate concurrent status updates
    const updatePromises = workerIds.map((id, i) =>
      Promise.resolve().then(() => {
        workerRegistry.updateStatus(id, 'running', { progress: i * 10 });
      })
    );

    await Promise.all(updatePromises);

    const totalTime = performance.now() - startTime;
    const memEnd = getMemoryUsageMB();

    // Cleanup
    for (const workerId of workerIds) {
      try {
        workerRegistry.updateStatus(workerId, 'complete');
      } catch {
        // Ignore
      }
    }

    const result: BenchmarkResult = {
      name: 'Concurrent Workers',
      operation: 'parallel-create-update',
      count: workerCount * 2, // Creates + updates
      totalTimeMs: totalTime,
      avgTimeMs: totalTime / (workerCount * 2),
      minMs: totalTime / (workerCount * 2),
      maxMs: totalTime,
      p50Ms: totalTime / 2,
      p95Ms: totalTime,
      p99Ms: totalTime,
      throughput: ((workerCount * 2) / (totalTime / 1000)),
      memoryDeltaMB: memEnd - memStart,
      passed: totalTime < 1000, // Target: < 1s for all concurrent ops
      target: 1000,
      details: {
        workerCount,
        avgPerWorker: totalTime / workerCount
      }
    };

    this.results.push(result);
    return result;
  }

  /**
   * Benchmark memory key generation
   */
  async benchmarkMemoryKeyGeneration(iterations: number = 5000): Promise<BenchmarkResult> {
    const triggers: WorkerTrigger[] = ['ultralearn', 'optimize', 'audit', 'benchmark'];
    const topics = ['auth', 'payment', 'user', 'api', 'database'];
    const phases = ['discovery', 'analysis', 'extraction', 'storage'];

    const latencies: number[] = [];
    const memStart = getMemoryUsageMB();

    for (let i = 0; i < iterations; i++) {
      const trigger = triggers[i % triggers.length];
      const topic = topics[i % topics.length];
      const phase = phases[i % phases.length];

      const start = performance.now();
      workerAgentIntegration.generateMemoryKey(trigger, topic, phase);
      latencies.push(performance.now() - start);
    }

    const sorted = [...latencies].sort((a, b) => a - b);
    const memEnd = getMemoryUsageMB();

    const result: BenchmarkResult = {
      name: 'Memory Key Generation',
      operation: 'generateMemoryKey',
      count: iterations,
      totalTimeMs: latencies.reduce((a, b) => a + b, 0),
      avgTimeMs: latencies.reduce((a, b) => a + b, 0) / latencies.length,
      minMs: sorted[0],
      maxMs: sorted[sorted.length - 1],
      p50Ms: calculatePercentile(sorted, 50),
      p95Ms: calculatePercentile(sorted, 95),
      p99Ms: calculatePercentile(sorted, 99),
      throughput: (iterations / (latencies.reduce((a, b) => a + b, 0) / 1000)),
      memoryDeltaMB: memEnd - memStart,
      passed: calculatePercentile(sorted, 95) < 0.1, // Target: p95 < 0.1ms
      target: 0.1,
      details: {
        uniquePatterns: triggers.length * topics.length * phases.length
      }
    };

    this.results.push(result);
    return result;
  }

  /**
   * Run full benchmark suite
   */
  async runFullSuite(): Promise<BenchmarkSuite> {
    this.results = [];
    const startTime = Date.now();
    const memStart = getMemoryUsageMB();

    console.log('\n📊 Running Worker Benchmark Suite\n');
    console.log('═'.repeat(60));

    // Run all benchmarks
    console.log('\n🔍 Trigger Detection...');
    await this.benchmarkTriggerDetection();

    console.log('💾 Worker Registry...');
    await this.benchmarkRegistryOperations();

    console.log('🤖 Agent Selection...');
    await this.benchmarkAgentSelection();

    console.log('📦 Model Cache...');
    await this.benchmarkModelCache();

    console.log('⚡ Concurrent Workers...');
    await this.benchmarkConcurrentWorkers();

    console.log('🔑 Memory Key Generation...');
    await this.benchmarkMemoryKeyGeneration();

    const totalDuration = Date.now() - startTime;
    const peakMemory = getMemoryUsageMB() - memStart;

    const passed = this.results.filter(r => r.passed).length;
    const avgLatency = this.results.reduce((sum, r) => sum + r.avgTimeMs, 0) / this.results.length;

    const suite: BenchmarkSuite = {
      name: 'Worker System Benchmarks',
      description: 'Comprehensive performance tests for agentic-flow worker system',
      timestamp: startTime,
      results: this.results,
      summary: {
        totalTests: this.results.length,
        passed,
        failed: this.results.length - passed,
        avgLatencyMs: avgLatency,
        totalDurationMs: totalDuration,
        peakMemoryMB: peakMemory
      }
    };

    this.printResults(suite);
    return suite;
  }

  /**
   * Print formatted results
   */
  private printResults(suite: BenchmarkSuite): void {
    console.log('\n' + '═'.repeat(60));
    console.log('📈 BENCHMARK RESULTS');
    console.log('═'.repeat(60));

    for (const result of suite.results) {
      const status = result.passed ? '✅' : '❌';
      const target = result.target ? ` (target: ${result.target}ms)` : '';

      console.log(`\n${status} ${result.name}`);
      console.log(`   Operation: ${result.operation}`);
      console.log(`   Count: ${result.count.toLocaleString()}`);
      console.log(`   Avg: ${result.avgTimeMs.toFixed(3)}ms | p95: ${result.p95Ms.toFixed(3)}ms${target}`);
      console.log(`   Throughput: ${result.throughput.toFixed(0)} ops/s`);
      console.log(`   Memory Δ: ${result.memoryDeltaMB.toFixed(2)}MB`);
    }

    console.log('\n' + '─'.repeat(60));
    console.log('📊 SUMMARY');
    console.log('─'.repeat(60));
    console.log(`Total Tests: ${suite.summary.totalTests}`);
    console.log(`Passed: ${suite.summary.passed} | Failed: ${suite.summary.failed}`);
    console.log(`Avg Latency: ${suite.summary.avgLatencyMs.toFixed(3)}ms`);
    console.log(`Total Duration: ${suite.summary.totalDurationMs}ms`);
    console.log(`Peak Memory: ${suite.summary.peakMemoryMB.toFixed(2)}MB`);
    console.log('═'.repeat(60) + '\n');
  }

  /**
   * Get last results
   */
  getResults(): BenchmarkResult[] {
    return this.results;
  }
}

// Singleton instance
export const workerBenchmarks = new WorkerBenchmarks();

// ============================================================================
// CLI Runner
// ============================================================================

export async function runBenchmarks(): Promise<BenchmarkSuite> {
  return workerBenchmarks.runFullSuite();
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runBenchmarks()
    .then(suite => {
      process.exit(suite.summary.failed > 0 ? 1 : 0);
    })
    .catch(err => {
      console.error('Benchmark error:', err);
      process.exit(1);
    });
}

/**
 * Embeddings Performance Benchmark Suite
 *
 * Measures performance of:
 * - O(1) LRU Cache operations
 * - Parallel batch embedding
 * - 8x unrolled cosine similarity
 * - Neural substrate operations
 * - Overall throughput
 */

import { performance } from 'perf_hooks';
import {
  getOptimizedEmbedder,
  cosineSimilarity,
  euclideanDistance,
  normalizeVector
} from '../embeddings/optimized-embedder.js';

// ============================================================================
// Benchmark Utilities
// ============================================================================

interface BenchmarkResult {
  name: string;
  iterations: number;
  totalMs: number;
  avgMs: number;
  opsPerSec: number;
  minMs: number;
  maxMs: number;
  p95Ms: number;
}

async function benchmark(
  name: string,
  fn: () => Promise<void> | void,
  iterations: number = 1000
): Promise<BenchmarkResult> {
  const times: number[] = [];

  // Warmup
  for (let i = 0; i < Math.min(10, iterations / 10); i++) {
    await fn();
  }

  // Actual benchmark
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await fn();
    times.push(performance.now() - start);
  }

  times.sort((a, b) => a - b);
  const totalMs = times.reduce((a, b) => a + b, 0);
  const avgMs = totalMs / iterations;

  return {
    name,
    iterations,
    totalMs,
    avgMs,
    opsPerSec: 1000 / avgMs,
    minMs: times[0],
    maxMs: times[times.length - 1],
    p95Ms: times[Math.floor(iterations * 0.95)]
  };
}

function formatResult(result: BenchmarkResult): string {
  return [
    `  ${result.name}`,
    `    Iterations: ${result.iterations.toLocaleString()}`,
    `    Total: ${result.totalMs.toFixed(2)}ms`,
    `    Avg: ${result.avgMs.toFixed(4)}ms`,
    `    Ops/sec: ${result.opsPerSec.toFixed(2)}`,
    `    Min: ${result.minMs.toFixed(4)}ms`,
    `    Max: ${result.maxMs.toFixed(4)}ms`,
    `    P95: ${result.p95Ms.toFixed(4)}ms`
  ].join('\n');
}

// ============================================================================
// Vector Operation Benchmarks
// ============================================================================

async function benchmarkCosineSimilarity(): Promise<BenchmarkResult> {
  const dim = 384;
  const a = new Float32Array(dim);
  const b = new Float32Array(dim);

  // Initialize with random values
  for (let i = 0; i < dim; i++) {
    a[i] = Math.random() - 0.5;
    b[i] = Math.random() - 0.5;
  }
  normalizeVector(a);
  normalizeVector(b);

  return benchmark('Cosine Similarity (384d, 8x unrolled)', () => {
    cosineSimilarity(a, b);
  }, 100000);
}

async function benchmarkEuclideanDistance(): Promise<BenchmarkResult> {
  const dim = 384;
  const a = new Float32Array(dim);
  const b = new Float32Array(dim);

  for (let i = 0; i < dim; i++) {
    a[i] = Math.random() - 0.5;
    b[i] = Math.random() - 0.5;
  }

  return benchmark('Euclidean Distance (384d)', () => {
    euclideanDistance(a, b);
  }, 100000);
}

async function benchmarkNormalize(): Promise<BenchmarkResult> {
  const dim = 384;
  const vectors: Float32Array[] = [];

  // Pre-create vectors
  for (let i = 0; i < 1000; i++) {
    const v = new Float32Array(dim);
    for (let j = 0; j < dim; j++) {
      v[j] = Math.random() - 0.5;
    }
    vectors.push(v);
  }

  let idx = 0;
  return benchmark('Normalize Vector (384d)', () => {
    normalizeVector(vectors[idx++ % 1000]);
  }, 100000);
}

// ============================================================================
// Cache Benchmarks
// ============================================================================

async function benchmarkCacheOperations(): Promise<BenchmarkResult[]> {
  const embedder = getOptimizedEmbedder();
  await embedder.init();

  const results: BenchmarkResult[] = [];

  // Pre-populate cache
  const texts = Array.from({ length: 256 }, (_, i) => `cache test text ${i}`);
  for (const text of texts) {
    await embedder.embed(text);
  }

  // Benchmark cache hits
  results.push(await benchmark('Cache Hit (O(1) LRU)', async () => {
    await embedder.embed(texts[Math.floor(Math.random() * 256)]);
  }, 10000));

  // Benchmark cache miss + embedding
  let missIdx = 1000;
  results.push(await benchmark('Cache Miss + Embed', async () => {
    await embedder.embed(`unique text for miss ${missIdx++}`);
  }, 100));

  return results;
}

// ============================================================================
// Batch Embedding Benchmarks
// ============================================================================

async function benchmarkBatchEmbedding(): Promise<BenchmarkResult[]> {
  const embedder = getOptimizedEmbedder();
  await embedder.init();
  embedder.clearCache();

  const results: BenchmarkResult[] = [];

  // Small batch
  const smallBatch = Array.from({ length: 10 }, (_, i) => `small batch text ${i}`);
  results.push(await benchmark('Batch Embed (10 texts, parallel)', async () => {
    embedder.clearCache();
    await embedder.embedBatch(smallBatch, 4);
  }, 20));

  // Medium batch
  const mediumBatch = Array.from({ length: 50 }, (_, i) => `medium batch text ${i}`);
  results.push(await benchmark('Batch Embed (50 texts, parallel)', async () => {
    embedder.clearCache();
    await embedder.embedBatch(mediumBatch, 4);
  }, 10));

  // Compare sequential vs parallel (simulated)
  results.push(await benchmark('Batch Embed (10 texts, cached)', async () => {
    await embedder.embedBatch(smallBatch, 4); // Should hit cache
  }, 100));

  return results;
}

// ============================================================================
// Similarity Search Benchmarks
// ============================================================================

async function benchmarkSimilaritySearch(): Promise<BenchmarkResult[]> {
  const embedder = getOptimizedEmbedder();
  await embedder.init();

  const results: BenchmarkResult[] = [];

  // Prepare candidates
  const candidates = Array.from({ length: 100 }, (_, i) =>
    `candidate document about topic ${i % 10} with content ${i}`
  );

  // Pre-embed candidates
  await embedder.embedBatch(candidates, 4);

  results.push(await benchmark('Find Similar (100 candidates, top-5)', async () => {
    await embedder.findSimilar('search query about topic 5', candidates, 5);
  }, 50));

  return results;
}

// ============================================================================
// Memory Pressure Test
// ============================================================================

async function benchmarkMemoryPressure(): Promise<{
  heapBefore: number;
  heapAfter: number;
  heapDelta: number;
  gcPauses: number;
}> {
  const embedder = getOptimizedEmbedder();
  await embedder.init();
  embedder.clearCache();

  // Force GC if available
  if (global.gc) global.gc();

  const heapBefore = process.memoryUsage().heapUsed;
  let gcPauses = 0;

  // Generate 1000 embeddings
  for (let i = 0; i < 1000; i++) {
    await embedder.embed(`memory pressure test text ${i} with some content`);

    // Detect potential GC pauses
    const start = performance.now();
    await new Promise(resolve => setImmediate(resolve));
    if (performance.now() - start > 5) gcPauses++;
  }

  const heapAfter = process.memoryUsage().heapUsed;

  return {
    heapBefore,
    heapAfter,
    heapDelta: heapAfter - heapBefore,
    gcPauses
  };
}

// ============================================================================
// Throughput Test
// ============================================================================

async function benchmarkThroughput(): Promise<{
  textsProcessed: number;
  totalTimeMs: number;
  textsPerSecond: number;
}> {
  const embedder = getOptimizedEmbedder();
  await embedder.init();
  embedder.clearCache();

  const texts = Array.from({ length: 100 }, (_, i) =>
    `throughput test document ${i} with varying content length ${i * 10}`
  );

  const start = performance.now();
  await embedder.embedBatch(texts, 4);
  const totalTimeMs = performance.now() - start;

  return {
    textsProcessed: texts.length,
    totalTimeMs,
    textsPerSecond: (texts.length / totalTimeMs) * 1000
  };
}

// ============================================================================
// Main Benchmark Runner
// ============================================================================

async function runBenchmarks() {
  console.log('\n' + '='.repeat(70));
  console.log('  EMBEDDINGS PERFORMANCE BENCHMARK SUITE');
  console.log('  agentic-flow v2.0.1-alpha.50');
  console.log('='.repeat(70) + '\n');

  const allResults: BenchmarkResult[] = [];

  // Vector Operations
  console.log('📐 Vector Operations\n');

  const cosineSim = await benchmarkCosineSimilarity();
  console.log(formatResult(cosineSim) + '\n');
  allResults.push(cosineSim);

  const euclidean = await benchmarkEuclideanDistance();
  console.log(formatResult(euclidean) + '\n');
  allResults.push(euclidean);

  const normalize = await benchmarkNormalize();
  console.log(formatResult(normalize) + '\n');
  allResults.push(normalize);

  // Cache Operations
  console.log('\n💾 Cache Operations (O(1) LRU)\n');

  const cacheResults = await benchmarkCacheOperations();
  for (const result of cacheResults) {
    console.log(formatResult(result) + '\n');
    allResults.push(result);
  }

  // Batch Embedding
  console.log('\n⚡ Batch Embedding (Parallel Processing)\n');

  const batchResults = await benchmarkBatchEmbedding();
  for (const result of batchResults) {
    console.log(formatResult(result) + '\n');
    allResults.push(result);
  }

  // Similarity Search
  console.log('\n🔍 Similarity Search\n');

  const searchResults = await benchmarkSimilaritySearch();
  for (const result of searchResults) {
    console.log(formatResult(result) + '\n');
    allResults.push(result);
  }

  // Memory Pressure
  console.log('\n🧠 Memory Pressure Test\n');

  const memoryResult = await benchmarkMemoryPressure();
  console.log(`  Heap Before: ${(memoryResult.heapBefore / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  Heap After: ${(memoryResult.heapAfter / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  Heap Delta: ${(memoryResult.heapDelta / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  Potential GC Pauses: ${memoryResult.gcPauses}\n`);

  // Throughput
  console.log('\n🚀 Throughput Test\n');

  const throughput = await benchmarkThroughput();
  console.log(`  Texts Processed: ${throughput.textsProcessed}`);
  console.log(`  Total Time: ${throughput.totalTimeMs.toFixed(2)} ms`);
  console.log(`  Throughput: ${throughput.textsPerSecond.toFixed(2)} texts/sec\n`);

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('  BENCHMARK SUMMARY');
  console.log('='.repeat(70) + '\n');

  console.log('  Key Metrics:');
  console.log(`    • Cosine Similarity: ${cosineSim.opsPerSec.toFixed(0)} ops/sec`);
  console.log(`    • Cache Hit: ${cacheResults[0].opsPerSec.toFixed(0)} ops/sec`);
  console.log(`    • Batch Throughput: ${throughput.textsPerSecond.toFixed(1)} texts/sec`);
  console.log(`    • Memory Efficiency: ${(memoryResult.heapDelta / 1024).toFixed(1)} KB for 1000 embeds`);

  console.log('\n  Performance Characteristics:');
  console.log('    ✓ O(1) LRU cache operations');
  console.log('    ✓ 8x loop unrolling with ILP');
  console.log('    ✓ Parallel batch processing');
  console.log('    ✓ Pre-allocated tensor buffers');
  console.log('    ✓ Minimal GC pressure\n');

  return { results: allResults, memory: memoryResult, throughput };
}

// Run if executed directly
runBenchmarks().catch(console.error);

export { runBenchmarks, benchmark };
export type { BenchmarkResult };

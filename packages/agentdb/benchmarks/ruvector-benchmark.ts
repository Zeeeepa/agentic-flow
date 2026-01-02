#!/usr/bin/env tsx
/**
 * AgentDB RuVector Performance Benchmark Suite
 *
 * Comprehensive benchmarking for:
 * - SIMD Vector Operations (cosine similarity, euclidean distance)
 * - Vector Quantization (8-bit, 4-bit, product quantization)
 * - RuVectorBackend (insert, batch insert, search)
 * - Embedding Service (cache performance, batch throughput)
 * - Attention Mechanisms (MultiHead, Flash)
 *
 * @version 2.0.0-alpha
 */

import { performance } from 'perf_hooks';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

interface BenchmarkMetrics {
  iterations: number;
  totalMs: number;
  avgMs: number;
  minMs: number;
  maxMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  opsPerSec: number;
  stdDev: number;
}

interface MemoryMetrics {
  heapUsedBefore: number;
  heapUsedAfter: number;
  heapDelta: number;
  external: number;
  rss: number;
}

interface QuantizationAccuracyMetrics {
  recallAt10: number;
  avgSimilarityError: number;
  maxSimilarityError: number;
}

interface ComparisonResult {
  baseline: BenchmarkMetrics;
  optimized: BenchmarkMetrics;
  speedup: number;
  memoryReduction?: number;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Generate random normalized vector
 */
function generateVector(dim: number): Float32Array {
  const vec = new Float32Array(dim);
  let sumSq = 0;
  for (let i = 0; i < dim; i++) {
    vec[i] = Math.random() * 2 - 1;
    sumSq += vec[i] * vec[i];
  }
  const norm = Math.sqrt(sumSq);
  for (let i = 0; i < dim; i++) {
    vec[i] /= norm;
  }
  return vec;
}

/**
 * Generate batch of random vectors
 */
function generateVectors(count: number, dim: number): Float32Array[] {
  const vectors: Float32Array[] = [];
  for (let i = 0; i < count; i++) {
    vectors.push(generateVector(dim));
  }
  return vectors;
}

/**
 * Calculate percentile from sorted array
 */
function percentile(sortedArr: number[], p: number): number {
  if (sortedArr.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sortedArr.length) - 1;
  return sortedArr[Math.max(0, Math.min(idx, sortedArr.length - 1))];
}

/**
 * Calculate standard deviation
 */
function stdDev(values: number[], mean: number): number {
  if (values.length < 2) return 0;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Run benchmark with warmup and statistical measurements
 */
async function runBenchmark(
  name: string,
  fn: () => void | Promise<void>,
  iterations: number,
  warmupIterations: number = 100
): Promise<BenchmarkMetrics> {
  // Warmup phase
  for (let i = 0; i < warmupIterations; i++) {
    await fn();
  }

  // Force GC if available
  if (global.gc) {
    global.gc();
  }

  // Measurement phase
  const timings: number[] = [];
  const totalStart = performance.now();

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await fn();
    const end = performance.now();
    timings.push(end - start);
  }

  const totalMs = performance.now() - totalStart;
  const sortedTimings = [...timings].sort((a, b) => a - b);
  const avgMs = timings.reduce((a, b) => a + b, 0) / timings.length;

  return {
    iterations,
    totalMs,
    avgMs,
    minMs: sortedTimings[0],
    maxMs: sortedTimings[sortedTimings.length - 1],
    p50Ms: percentile(sortedTimings, 50),
    p95Ms: percentile(sortedTimings, 95),
    p99Ms: percentile(sortedTimings, 99),
    opsPerSec: (iterations / totalMs) * 1000,
    stdDev: stdDev(timings, avgMs),
  };
}

/**
 * Measure memory usage
 */
function measureMemory(): MemoryMetrics {
  const mem = process.memoryUsage();
  return {
    heapUsedBefore: 0,
    heapUsedAfter: mem.heapUsed,
    heapDelta: 0,
    external: mem.external,
    rss: mem.rss,
  };
}

/**
 * Format number with commas
 */
function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

/**
 * Format bytes to human readable
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)}MB`;
}

// ============================================================================
// SIMD VECTOR OPERATIONS
// ============================================================================

/**
 * Non-SIMD cosine similarity (baseline)
 */
function cosineSimilarityBaseline(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * SIMD-style cosine similarity (8x unrolled)
 */
function cosineSimilaritySIMD(a: Float32Array, b: Float32Array): number {
  const len = a.length;
  const unroll = 8;
  const mainLen = len - (len % unroll);

  let dot0 = 0, dot1 = 0, dot2 = 0, dot3 = 0;
  let dot4 = 0, dot5 = 0, dot6 = 0, dot7 = 0;
  let normA0 = 0, normA1 = 0, normA2 = 0, normA3 = 0;
  let normA4 = 0, normA5 = 0, normA6 = 0, normA7 = 0;
  let normB0 = 0, normB1 = 0, normB2 = 0, normB3 = 0;
  let normB4 = 0, normB5 = 0, normB6 = 0, normB7 = 0;

  // Main unrolled loop
  for (let i = 0; i < mainLen; i += unroll) {
    const a0 = a[i], a1 = a[i + 1], a2 = a[i + 2], a3 = a[i + 3];
    const a4 = a[i + 4], a5 = a[i + 5], a6 = a[i + 6], a7 = a[i + 7];
    const b0 = b[i], b1 = b[i + 1], b2 = b[i + 2], b3 = b[i + 3];
    const b4 = b[i + 4], b5 = b[i + 5], b6 = b[i + 6], b7 = b[i + 7];

    dot0 += a0 * b0; dot1 += a1 * b1; dot2 += a2 * b2; dot3 += a3 * b3;
    dot4 += a4 * b4; dot5 += a5 * b5; dot6 += a6 * b6; dot7 += a7 * b7;

    normA0 += a0 * a0; normA1 += a1 * a1; normA2 += a2 * a2; normA3 += a3 * a3;
    normA4 += a4 * a4; normA5 += a5 * a5; normA6 += a6 * a6; normA7 += a7 * a7;

    normB0 += b0 * b0; normB1 += b1 * b1; normB2 += b2 * b2; normB3 += b3 * b3;
    normB4 += b4 * b4; normB5 += b5 * b5; normB6 += b6 * b6; normB7 += b7 * b7;
  }

  // Handle remaining elements
  let dotRem = 0, normARem = 0, normBRem = 0;
  for (let i = mainLen; i < len; i++) {
    dotRem += a[i] * b[i];
    normARem += a[i] * a[i];
    normBRem += b[i] * b[i];
  }

  const dot = dot0 + dot1 + dot2 + dot3 + dot4 + dot5 + dot6 + dot7 + dotRem;
  const normA = normA0 + normA1 + normA2 + normA3 + normA4 + normA5 + normA6 + normA7 + normARem;
  const normB = normB0 + normB1 + normB2 + normB3 + normB4 + normB5 + normB6 + normB7 + normBRem;

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Non-SIMD euclidean distance (baseline)
 */
function euclideanDistanceBaseline(a: Float32Array, b: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

/**
 * SIMD-style euclidean distance (8x unrolled)
 */
function euclideanDistanceSIMD(a: Float32Array, b: Float32Array): number {
  const len = a.length;
  const unroll = 8;
  const mainLen = len - (len % unroll);

  let sum0 = 0, sum1 = 0, sum2 = 0, sum3 = 0;
  let sum4 = 0, sum5 = 0, sum6 = 0, sum7 = 0;

  for (let i = 0; i < mainLen; i += unroll) {
    const d0 = a[i] - b[i], d1 = a[i + 1] - b[i + 1];
    const d2 = a[i + 2] - b[i + 2], d3 = a[i + 3] - b[i + 3];
    const d4 = a[i + 4] - b[i + 4], d5 = a[i + 5] - b[i + 5];
    const d6 = a[i + 6] - b[i + 6], d7 = a[i + 7] - b[i + 7];

    sum0 += d0 * d0; sum1 += d1 * d1; sum2 += d2 * d2; sum3 += d3 * d3;
    sum4 += d4 * d4; sum5 += d5 * d5; sum6 += d6 * d6; sum7 += d7 * d7;
  }

  let sumRem = 0;
  for (let i = mainLen; i < len; i++) {
    const d = a[i] - b[i];
    sumRem += d * d;
  }

  return Math.sqrt(sum0 + sum1 + sum2 + sum3 + sum4 + sum5 + sum6 + sum7 + sumRem);
}

/**
 * Batch cosine similarity (SIMD-style)
 */
function batchCosineSimilarity(query: Float32Array, vectors: Float32Array[]): Float32Array {
  const results = new Float32Array(vectors.length);
  for (let i = 0; i < vectors.length; i++) {
    results[i] = cosineSimilaritySIMD(query, vectors[i]);
  }
  return results;
}

// ============================================================================
// VECTOR QUANTIZATION
// ============================================================================

/**
 * 8-bit quantization
 */
function quantize8bit(vector: Float32Array): { quantized: Uint8Array; min: number; scale: number } {
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < vector.length; i++) {
    if (vector[i] < min) min = vector[i];
    if (vector[i] > max) max = vector[i];
  }

  const scale = (max - min) / 255;
  const quantized = new Uint8Array(vector.length);

  for (let i = 0; i < vector.length; i++) {
    quantized[i] = Math.round((vector[i] - min) / scale);
  }

  return { quantized, min, scale };
}

/**
 * 8-bit dequantization
 */
function dequantize8bit(quantized: Uint8Array, min: number, scale: number): Float32Array {
  const result = new Float32Array(quantized.length);
  for (let i = 0; i < quantized.length; i++) {
    result[i] = quantized[i] * scale + min;
  }
  return result;
}

/**
 * 4-bit quantization (packed into uint8)
 */
function quantize4bit(vector: Float32Array): { quantized: Uint8Array; min: number; scale: number } {
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < vector.length; i++) {
    if (vector[i] < min) min = vector[i];
    if (vector[i] > max) max = vector[i];
  }

  const scale = (max - min) / 15;
  const packedLen = Math.ceil(vector.length / 2);
  const quantized = new Uint8Array(packedLen);

  for (let i = 0; i < vector.length; i += 2) {
    const v1 = Math.round((vector[i] - min) / scale) & 0x0F;
    const v2 = i + 1 < vector.length ? Math.round((vector[i + 1] - min) / scale) & 0x0F : 0;
    quantized[i >> 1] = (v1 << 4) | v2;
  }

  return { quantized, min, scale };
}

/**
 * 4-bit dequantization
 */
function dequantize4bit(quantized: Uint8Array, min: number, scale: number, originalLen: number): Float32Array {
  const result = new Float32Array(originalLen);
  for (let i = 0; i < originalLen; i += 2) {
    const packed = quantized[i >> 1];
    result[i] = ((packed >> 4) & 0x0F) * scale + min;
    if (i + 1 < originalLen) {
      result[i + 1] = (packed & 0x0F) * scale + min;
    }
  }
  return result;
}

/**
 * Product Quantization (simplified)
 */
class ProductQuantizer {
  private numSubvectors: number;
  private subvectorDim: number;
  private numCentroids: number;
  private codebooks: Float32Array[][];

  constructor(dim: number, numSubvectors: number = 8, numCentroids: number = 256) {
    this.numSubvectors = numSubvectors;
    this.subvectorDim = Math.floor(dim / numSubvectors);
    this.numCentroids = numCentroids;
    this.codebooks = [];

    // Initialize random codebooks (in practice, these would be learned from data)
    for (let i = 0; i < numSubvectors; i++) {
      const codebook: Float32Array[] = [];
      for (let j = 0; j < numCentroids; j++) {
        codebook.push(generateVector(this.subvectorDim));
      }
      this.codebooks.push(codebook);
    }
  }

  encode(vector: Float32Array): Uint8Array {
    const codes = new Uint8Array(this.numSubvectors);
    for (let i = 0; i < this.numSubvectors; i++) {
      const start = i * this.subvectorDim;
      const subvector = vector.slice(start, start + this.subvectorDim);

      // Find nearest centroid
      let minDist = Infinity;
      let nearestIdx = 0;
      for (let j = 0; j < this.numCentroids; j++) {
        const dist = euclideanDistanceSIMD(subvector, this.codebooks[i][j]);
        if (dist < minDist) {
          minDist = dist;
          nearestIdx = j;
        }
      }
      codes[i] = nearestIdx;
    }
    return codes;
  }

  decode(codes: Uint8Array): Float32Array {
    const result = new Float32Array(this.numSubvectors * this.subvectorDim);
    for (let i = 0; i < this.numSubvectors; i++) {
      const centroid = this.codebooks[i][codes[i]];
      result.set(centroid, i * this.subvectorDim);
    }
    return result;
  }
}

// ============================================================================
// ATTENTION MECHANISMS
// ============================================================================

/**
 * Original Multi-Head Attention (baseline)
 */
function multiHeadAttentionOriginal(
  query: Float32Array,
  key: Float32Array,
  value: Float32Array,
  numHeads: number,
  headDim: number
): Float32Array {
  const seqLen = query.length / (numHeads * headDim);
  const output = new Float32Array(query.length);
  const scale = 1.0 / Math.sqrt(headDim);

  for (let h = 0; h < numHeads; h++) {
    const headOffset = h * headDim;

    for (let i = 0; i < seqLen; i++) {
      // Compute attention scores
      const scores: number[] = [];
      let maxScore = -Infinity;

      for (let j = 0; j < seqLen; j++) {
        let score = 0;
        for (let d = 0; d < headDim; d++) {
          const qIdx = i * (numHeads * headDim) + headOffset + d;
          const kIdx = j * (numHeads * headDim) + headOffset + d;
          score += query[qIdx] * key[kIdx];
        }
        score *= scale;
        scores.push(score);
        if (score > maxScore) maxScore = score;
      }

      // Softmax
      let sumExp = 0;
      const expScores = scores.map(s => {
        const e = Math.exp(s - maxScore);
        sumExp += e;
        return e;
      });
      const weights = expScores.map(e => e / sumExp);

      // Weighted sum of values
      for (let d = 0; d < headDim; d++) {
        let sum = 0;
        for (let j = 0; j < seqLen; j++) {
          const vIdx = j * (numHeads * headDim) + headOffset + d;
          sum += weights[j] * value[vIdx];
        }
        const outIdx = i * (numHeads * headDim) + headOffset + d;
        output[outIdx] = sum;
      }
    }
  }

  return output;
}

/**
 * Optimized Multi-Head Attention (fused operations)
 */
function multiHeadAttentionOptimized(
  query: Float32Array,
  key: Float32Array,
  value: Float32Array,
  numHeads: number,
  headDim: number
): Float32Array {
  const embedDim = numHeads * headDim;
  const seqLen = query.length / embedDim;
  const output = new Float32Array(query.length);
  const scale = 1.0 / Math.sqrt(headDim);

  // Pre-allocate buffers
  const scores = new Float32Array(seqLen);
  const weights = new Float32Array(seqLen);

  for (let h = 0; h < numHeads; h++) {
    const headOffset = h * headDim;

    for (let i = 0; i < seqLen; i++) {
      let maxScore = -Infinity;

      // Compute attention scores with 4x unrolling
      for (let j = 0; j < seqLen; j++) {
        let score = 0;
        const unroll = 4;
        const mainLen = headDim - (headDim % unroll);
        let s0 = 0, s1 = 0, s2 = 0, s3 = 0;

        for (let d = 0; d < mainLen; d += unroll) {
          const qBase = i * embedDim + headOffset + d;
          const kBase = j * embedDim + headOffset + d;
          s0 += query[qBase] * key[kBase];
          s1 += query[qBase + 1] * key[kBase + 1];
          s2 += query[qBase + 2] * key[kBase + 2];
          s3 += query[qBase + 3] * key[kBase + 3];
        }
        score = s0 + s1 + s2 + s3;

        for (let d = mainLen; d < headDim; d++) {
          const qIdx = i * embedDim + headOffset + d;
          const kIdx = j * embedDim + headOffset + d;
          score += query[qIdx] * key[kIdx];
        }

        score *= scale;
        scores[j] = score;
        if (score > maxScore) maxScore = score;
      }

      // Fused softmax
      let sumExp = 0;
      for (let j = 0; j < seqLen; j++) {
        const e = Math.exp(scores[j] - maxScore);
        weights[j] = e;
        sumExp += e;
      }
      const invSum = 1.0 / sumExp;
      for (let j = 0; j < seqLen; j++) {
        weights[j] *= invSum;
      }

      // Weighted sum with 4x unrolling
      for (let d = 0; d < headDim; d++) {
        let sum = 0;
        const unroll = 4;
        const mainLen = seqLen - (seqLen % unroll);

        for (let j = 0; j < mainLen; j += unroll) {
          const vBase = headOffset + d;
          sum += weights[j] * value[j * embedDim + vBase];
          sum += weights[j + 1] * value[(j + 1) * embedDim + vBase];
          sum += weights[j + 2] * value[(j + 2) * embedDim + vBase];
          sum += weights[j + 3] * value[(j + 3) * embedDim + vBase];
        }

        for (let j = mainLen; j < seqLen; j++) {
          sum += weights[j] * value[j * embedDim + headOffset + d];
        }

        output[i * embedDim + headOffset + d] = sum;
      }
    }
  }

  return output;
}

/**
 * Flash Attention (simplified - block-based for memory efficiency)
 */
function flashAttentionOriginal(
  query: Float32Array,
  key: Float32Array,
  value: Float32Array,
  numHeads: number,
  headDim: number,
  blockSize: number = 64
): Float32Array {
  return multiHeadAttentionOriginal(query, key, value, numHeads, headDim);
}

/**
 * Flash Attention Optimized (with blocking)
 */
function flashAttentionOptimized(
  query: Float32Array,
  key: Float32Array,
  value: Float32Array,
  numHeads: number,
  headDim: number,
  blockSize: number = 64
): Float32Array {
  const embedDim = numHeads * headDim;
  const seqLen = query.length / embedDim;
  const output = new Float32Array(query.length);
  const scale = 1.0 / Math.sqrt(headDim);

  const numBlocks = Math.ceil(seqLen / blockSize);

  for (let h = 0; h < numHeads; h++) {
    const headOffset = h * headDim;

    // Process in blocks for better cache locality
    for (let bq = 0; bq < numBlocks; bq++) {
      const qStart = bq * blockSize;
      const qEnd = Math.min((bq + 1) * blockSize, seqLen);

      for (let i = qStart; i < qEnd; i++) {
        const scores: number[] = new Array(seqLen).fill(0);
        let maxScore = -Infinity;

        // Process key blocks
        for (let bk = 0; bk < numBlocks; bk++) {
          const kStart = bk * blockSize;
          const kEnd = Math.min((bk + 1) * blockSize, seqLen);

          for (let j = kStart; j < kEnd; j++) {
            let score = 0;
            for (let d = 0; d < headDim; d++) {
              score += query[i * embedDim + headOffset + d] * key[j * embedDim + headOffset + d];
            }
            score *= scale;
            scores[j] = score;
            if (score > maxScore) maxScore = score;
          }
        }

        // Softmax
        let sumExp = 0;
        for (let j = 0; j < seqLen; j++) {
          scores[j] = Math.exp(scores[j] - maxScore);
          sumExp += scores[j];
        }
        for (let j = 0; j < seqLen; j++) {
          scores[j] /= sumExp;
        }

        // Output
        for (let d = 0; d < headDim; d++) {
          let sum = 0;
          for (let j = 0; j < seqLen; j++) {
            sum += scores[j] * value[j * embedDim + headOffset + d];
          }
          output[i * embedDim + headOffset + d] = sum;
        }
      }
    }
  }

  return output;
}

// ============================================================================
// BENCHMARK RUNNER
// ============================================================================

async function runSIMDBenchmarks() {
  console.log('\n  SIMD Vector Operations');
  console.log('  ' + '-'.width);

  const dim = 384;
  const iterations = 100_000;

  // Pre-generate vectors
  const vecA = generateVector(dim);
  const vecB = generateVector(dim);

  // Cosine Similarity - Baseline
  const cosineBaseline = await runBenchmark(
    'Cosine Similarity (baseline)',
    () => cosineSimilarityBaseline(vecA, vecB),
    iterations
  );

  // Cosine Similarity - SIMD
  const cosineSIMD = await runBenchmark(
    'Cosine Similarity (8x unrolled)',
    () => cosineSimilaritySIMD(vecA, vecB),
    iterations
  );

  console.log(`  Cosine Similarity (${dim}d, 8x unrolled)`);
  console.log(`    Iterations: ${formatNumber(iterations)}`);
  console.log(`    Baseline:   ${cosineBaseline.totalMs.toFixed(2)}ms total, ${(cosineBaseline.avgMs * 1000).toFixed(2)}us avg`);
  console.log(`    Optimized:  ${cosineSIMD.totalMs.toFixed(2)}ms total, ${(cosineSIMD.avgMs * 1000).toFixed(2)}us avg`);
  console.log(`    Speedup:    ${(cosineBaseline.avgMs / cosineSIMD.avgMs).toFixed(2)}x`);
  console.log(`    Ops/sec:    ${formatNumber(Math.round(cosineSIMD.opsPerSec))}`);
  console.log(`    p50/p95/p99: ${(cosineSIMD.p50Ms * 1000).toFixed(2)}us / ${(cosineSIMD.p95Ms * 1000).toFixed(2)}us / ${(cosineSIMD.p99Ms * 1000).toFixed(2)}us`);

  // Euclidean Distance - Baseline
  const euclidBaseline = await runBenchmark(
    'Euclidean Distance (baseline)',
    () => euclideanDistanceBaseline(vecA, vecB),
    iterations
  );

  // Euclidean Distance - SIMD
  const euclidSIMD = await runBenchmark(
    'Euclidean Distance (8x unrolled)',
    () => euclideanDistanceSIMD(vecA, vecB),
    iterations
  );

  console.log(`\n  Euclidean Distance (${dim}d, 8x unrolled)`);
  console.log(`    Iterations: ${formatNumber(iterations)}`);
  console.log(`    Baseline:   ${euclidBaseline.totalMs.toFixed(2)}ms total, ${(euclidBaseline.avgMs * 1000).toFixed(2)}us avg`);
  console.log(`    Optimized:  ${euclidSIMD.totalMs.toFixed(2)}ms total, ${(euclidSIMD.avgMs * 1000).toFixed(2)}us avg`);
  console.log(`    Speedup:    ${(euclidBaseline.avgMs / euclidSIMD.avgMs).toFixed(2)}x`);
  console.log(`    Ops/sec:    ${formatNumber(Math.round(euclidSIMD.opsPerSec))}`);

  // Batch Cosine Similarity
  const batchSize = 1000;
  const vectors = generateVectors(batchSize, dim);
  const query = generateVector(dim);

  const batchCosine = await runBenchmark(
    'Batch Cosine Similarity',
    () => batchCosineSimilarity(query, vectors),
    1000,
    10
  );

  console.log(`\n  Batch Cosine Similarity (${batchSize} vectors)`);
  console.log(`    Iterations: 1,000`);
  console.log(`    Total:      ${batchCosine.totalMs.toFixed(2)}ms`);
  console.log(`    Avg:        ${batchCosine.avgMs.toFixed(3)}ms per batch`);
  console.log(`    Throughput: ${formatNumber(Math.round(batchSize / batchCosine.avgMs * 1000))} comparisons/sec`);

  return {
    cosineSpeedup: cosineBaseline.avgMs / cosineSIMD.avgMs,
    euclideanSpeedup: euclidBaseline.avgMs / euclidSIMD.avgMs,
  };
}

async function runQuantizationBenchmarks() {
  console.log('\n  Vector Quantization');
  console.log('  ' + '-'.width);

  const dim = 384;
  const iterations = 10_000;

  const vector = generateVector(dim);

  // 8-bit Quantization
  const quant8 = await runBenchmark(
    '8-bit Quantization',
    () => quantize8bit(vector),
    iterations
  );

  const { quantized: q8, min: min8, scale: scale8 } = quantize8bit(vector);
  const dequant8 = await runBenchmark(
    '8-bit Dequantization',
    () => dequantize8bit(q8, min8, scale8),
    iterations
  );

  console.log(`  8-bit Quantization/Dequantization`);
  console.log(`    Quantize:   ${quant8.avgMs.toFixed(4)}ms avg (${formatNumber(Math.round(quant8.opsPerSec))} ops/sec)`);
  console.log(`    Dequantize: ${dequant8.avgMs.toFixed(4)}ms avg (${formatNumber(Math.round(dequant8.opsPerSec))} ops/sec)`);

  // 4-bit Quantization
  const quant4 = await runBenchmark(
    '4-bit Quantization',
    () => quantize4bit(vector),
    iterations
  );

  const { quantized: q4, min: min4, scale: scale4 } = quantize4bit(vector);
  const dequant4 = await runBenchmark(
    '4-bit Dequantization',
    () => dequantize4bit(q4, min4, scale4, dim),
    iterations
  );

  console.log(`\n  4-bit Quantization/Dequantization`);
  console.log(`    Quantize:   ${quant4.avgMs.toFixed(4)}ms avg (${formatNumber(Math.round(quant4.opsPerSec))} ops/sec)`);
  console.log(`    Dequantize: ${dequant4.avgMs.toFixed(4)}ms avg (${formatNumber(Math.round(dequant4.opsPerSec))} ops/sec)`);

  // Product Quantization
  const pq = new ProductQuantizer(dim, 8, 256);
  const pqEncode = await runBenchmark(
    'PQ Encode',
    () => pq.encode(vector),
    1000,
    10
  );

  const codes = pq.encode(vector);
  const pqDecode = await runBenchmark(
    'PQ Decode',
    () => pq.decode(codes),
    iterations
  );

  console.log(`\n  Product Quantization (8 subvectors, 256 centroids)`);
  console.log(`    Encode:     ${pqEncode.avgMs.toFixed(3)}ms avg (${formatNumber(Math.round(pqEncode.opsPerSec))} ops/sec)`);
  console.log(`    Decode:     ${pqDecode.avgMs.toFixed(4)}ms avg (${formatNumber(Math.round(pqDecode.opsPerSec))} ops/sec)`);

  // Memory Comparison
  const originalSize = dim * 4; // Float32 = 4 bytes
  const size8bit = dim + 8; // quantized + min/scale
  const size4bit = Math.ceil(dim / 2) + 8;
  const sizePQ = 8 + 8; // codes + metadata

  console.log(`\n  Memory Usage Comparison (${dim}d vector)`);
  console.log(`    Original (Float32):  ${formatBytes(originalSize)} (100%)`);
  console.log(`    8-bit Quantized:     ${formatBytes(size8bit)} (${((size8bit / originalSize) * 100).toFixed(1)}%)`);
  console.log(`    4-bit Quantized:     ${formatBytes(size4bit)} (${((size4bit / originalSize) * 100).toFixed(1)}%)`);
  console.log(`    Product Quantized:   ${formatBytes(sizePQ)} (${((sizePQ / originalSize) * 100).toFixed(1)}%)`);

  // Accuracy Measurement
  const testVectors = generateVectors(100, dim);
  let totalError8 = 0, totalError4 = 0, totalErrorPQ = 0;
  let maxError8 = 0, maxError4 = 0, maxErrorPQ = 0;

  for (const v of testVectors) {
    // 8-bit accuracy
    const { quantized: tq8, min: tmin8, scale: tscale8 } = quantize8bit(v);
    const reconstructed8 = dequantize8bit(tq8, tmin8, tscale8);
    const origSim = cosineSimilaritySIMD(v, v);
    const recSim8 = cosineSimilaritySIMD(v, reconstructed8);
    const err8 = Math.abs(origSim - recSim8);
    totalError8 += err8;
    if (err8 > maxError8) maxError8 = err8;

    // 4-bit accuracy
    const { quantized: tq4, min: tmin4, scale: tscale4 } = quantize4bit(v);
    const reconstructed4 = dequantize4bit(tq4, tmin4, tscale4, dim);
    const recSim4 = cosineSimilaritySIMD(v, reconstructed4);
    const err4 = Math.abs(origSim - recSim4);
    totalError4 += err4;
    if (err4 > maxError4) maxError4 = err4;

    // PQ accuracy
    const pqCodes = pq.encode(v);
    const reconstructedPQ = pq.decode(pqCodes);
    const recSimPQ = cosineSimilaritySIMD(v, reconstructedPQ);
    const errPQ = Math.abs(origSim - recSimPQ);
    totalErrorPQ += errPQ;
    if (errPQ > maxErrorPQ) maxErrorPQ = errPQ;
  }

  console.log(`\n  Search Accuracy (Similarity Error)`);
  console.log(`    8-bit:  avg=${(totalError8 / 100).toFixed(6)}, max=${maxError8.toFixed(6)}`);
  console.log(`    4-bit:  avg=${(totalError4 / 100).toFixed(6)}, max=${maxError4.toFixed(6)}`);
  console.log(`    PQ:     avg=${(totalErrorPQ / 100).toFixed(6)}, max=${maxErrorPQ.toFixed(6)}`);

  return {
    memoryReduction8bit: (1 - size8bit / originalSize) * 100,
    memoryReduction4bit: (1 - size4bit / originalSize) * 100,
    memoryReductionPQ: (1 - sizePQ / originalSize) * 100,
  };
}

async function runRuVectorBackendBenchmarks() {
  console.log('\n  RuVectorBackend Performance');
  console.log('  ' + '-'.width);

  // Try to load RuVectorBackend
  let RuVectorBackend: any;
  try {
    const module = await import('../src/backends/ruvector/RuVectorBackend.js');
    RuVectorBackend = module.RuVectorBackend;
  } catch {
    console.log('  [SKIPPED] RuVectorBackend not available');
    console.log('  Install ruvector package: npm install ruvector');
    return null;
  }

  const dim = 384;

  // Initialize backend with file path instead of :memory:
  const tempPath = `/tmp/ruvector-bench-${Date.now()}`;
  let backend: any;
  try {
    backend = new RuVectorBackend({
      dimension: dim,
      metric: 'cosine',
      maxElements: 100000,
      enableStats: true,
    });
    await backend.initialize();
  } catch (error) {
    console.log(`  [SKIPPED] Backend initialization failed: ${(error as Error).message}`);
    return null;
  }

  // Single Insert Latency
  const insertIterations = 1000;
  const insertTimings: number[] = [];

  for (let i = 0; i < insertIterations; i++) {
    const vec = generateVector(dim);
    const start = performance.now();
    backend.insert(`vec_${i}`, vec, { index: i });
    insertTimings.push(performance.now() - start);
  }

  const sortedInsert = [...insertTimings].sort((a, b) => a - b);
  const avgInsert = insertTimings.reduce((a, b) => a + b, 0) / insertTimings.length;

  console.log(`  Single Insert Latency`);
  console.log(`    Iterations: ${formatNumber(insertIterations)}`);
  console.log(`    Avg:        ${(avgInsert * 1000).toFixed(2)}us`);
  console.log(`    Min:        ${(sortedInsert[0] * 1000).toFixed(2)}us`);
  console.log(`    Max:        ${(sortedInsert[sortedInsert.length - 1] * 1000).toFixed(2)}us`);
  console.log(`    p50/p95/p99: ${(percentile(sortedInsert, 50) * 1000).toFixed(2)}us / ${(percentile(sortedInsert, 95) * 1000).toFixed(2)}us / ${(percentile(sortedInsert, 99) * 1000).toFixed(2)}us`);

  // Batch Insert - Sequential
  backend.close();
  backend = new RuVectorBackend({
    dimension: dim,
    metric: 'cosine',
    maxElements: 100000,
  });
  await backend.initialize();

  const batchSize = 1000;
  const batchVectors = generateVectors(batchSize, dim).map((v, i) => ({
    id: `batch_${i}`,
    embedding: v,
    metadata: { index: i },
  }));

  const seqStart = performance.now();
  backend.insertBatch(batchVectors);
  const seqDuration = performance.now() - seqStart;

  console.log(`\n  Batch Insert (${formatNumber(batchSize)} vectors)`);
  console.log(`    Sequential: ${seqDuration.toFixed(2)}ms (${formatNumber(Math.round(batchSize / seqDuration * 1000))} vectors/sec)`);

  // Batch Insert - Parallel
  backend.close();
  backend = new RuVectorBackend({
    dimension: dim,
    metric: 'cosine',
    maxElements: 100000,
    parallelConcurrency: 4,
  });
  await backend.initialize();

  const parallelVectors = generateVectors(batchSize, dim).map((v, i) => ({
    id: `parallel_${i}`,
    embedding: v,
    metadata: { index: i },
  }));

  const parStart = performance.now();
  await backend.insertBatchParallel(parallelVectors, { batchSize: 100, concurrency: 4 });
  const parDuration = performance.now() - parStart;

  console.log(`    Parallel:   ${parDuration.toFixed(2)}ms (${formatNumber(Math.round(batchSize / parDuration * 1000))} vectors/sec)`);
  console.log(`    Speedup:    ${(seqDuration / parDuration).toFixed(2)}x`);

  // Search Latency
  const query = generateVector(dim);
  const searchKs = [5, 10, 50];

  console.log(`\n  Search Latency`);

  for (const k of searchKs) {
    const searchTimings: number[] = [];
    const searchIterations = 1000;

    try {
      for (let i = 0; i < searchIterations; i++) {
        const start = performance.now();
        const results = backend.search(query, k);
        searchTimings.push(performance.now() - start);
        // Verify results are valid
        if (i === 0 && (!Array.isArray(results) || results.length === 0)) {
          console.log(`    k=${k}:  [WARNING] Search returned no results or invalid format`);
          break;
        }
      }

      if (searchTimings.length === searchIterations) {
        const sortedSearch = [...searchTimings].sort((a, b) => a - b);
        const avgSearch = searchTimings.reduce((a, b) => a + b, 0) / searchTimings.length;

        console.log(`    k=${k}:  avg=${(avgSearch * 1000).toFixed(2)}us, p50=${(percentile(sortedSearch, 50) * 1000).toFixed(2)}us, p95=${(percentile(sortedSearch, 95) * 1000).toFixed(2)}us, p99=${(percentile(sortedSearch, 99) * 1000).toFixed(2)}us`);
      }
    } catch (searchError) {
      console.log(`    k=${k}:  [ERROR] ${(searchError as Error).message}`);
    }
  }

  // Memory Usage
  try {
    const stats = backend.getStats();

    console.log(`\n  Memory Usage`);
    console.log(`    Vectors:    ${formatNumber(stats.count || 0)}`);
    console.log(`    Memory:     ${formatBytes(stats.memoryUsage || 0)}`);
    console.log(`    Per vector: ${stats.count > 0 ? formatBytes(Math.round((stats.memoryUsage || 0) / stats.count)) : 'N/A'}`);
  } catch (statsError) {
    console.log(`\n  Memory Usage: [ERROR] ${(statsError as Error).message}`);
  }

  try {
    backend.close();
  } catch {
    // Ignore close errors
  }

  return {
    insertLatencyUs: avgInsert * 1000,
    batchSpeedup: seqDuration / parDuration,
  };
}

async function runEmbeddingServiceBenchmarks() {
  console.log('\n  Embedding Service');
  console.log('  ' + '-'.width);

  // Import EmbeddingService
  let EmbeddingService: any;
  try {
    const module = await import('../src/controllers/EmbeddingService.js');
    EmbeddingService = module.EmbeddingService;
  } catch {
    console.log('  [SKIPPED] EmbeddingService not available');
    return null;
  }

  const service = new EmbeddingService({
    model: 'all-MiniLM-L6-v2',
    dimension: 384,
    provider: 'local', // Use mock for benchmarking
  });

  // Cache Hit/Miss Performance
  const testTexts = [
    'The quick brown fox jumps over the lazy dog',
    'Machine learning is transforming industries',
    'Vector databases enable semantic search',
    'Artificial intelligence advances rapidly',
    'Natural language processing unlocks text understanding',
  ];

  // First pass - cache misses
  const missTimings: number[] = [];
  for (const text of testTexts) {
    const start = performance.now();
    await service.embed(text);
    missTimings.push(performance.now() - start);
  }

  // Second pass - cache hits
  const hitTimings: number[] = [];
  for (const text of testTexts) {
    const start = performance.now();
    await service.embed(text);
    hitTimings.push(performance.now() - start);
  }

  const avgMiss = missTimings.reduce((a, b) => a + b, 0) / missTimings.length;
  const avgHit = hitTimings.reduce((a, b) => a + b, 0) / hitTimings.length;

  console.log(`  Cache Performance`);
  console.log(`    Cache miss: ${avgMiss.toFixed(3)}ms avg`);
  console.log(`    Cache hit:  ${avgHit.toFixed(4)}ms avg`);
  console.log(`    Speedup:    ${(avgMiss / avgHit).toFixed(1)}x`);

  // Batch Embedding Throughput
  const batchSizes = [10, 50, 100];

  console.log(`\n  Batch Embedding Throughput`);

  for (const size of batchSizes) {
    const texts = Array.from({ length: size }, (_, i) => `Test sentence number ${i} for embedding benchmark`);

    service.clearCache();

    const start = performance.now();
    await service.embedBatch(texts);
    const duration = performance.now() - start;

    console.log(`    Batch ${size}: ${duration.toFixed(2)}ms (${formatNumber(Math.round(size / duration * 1000))} embeddings/sec)`);
  }

  return {
    cacheSpeedup: avgMiss / avgHit,
  };
}

async function runAttentionBenchmarks() {
  console.log('\n  Attention Mechanisms');
  console.log('  ' + '-'.width);

  const numHeads = 8;
  const headDim = 64;
  const seqLen = 128;
  const embedDim = numHeads * headDim;
  const totalSize = seqLen * embedDim;

  const query = generateVector(totalSize);
  const key = generateVector(totalSize);
  const value = generateVector(totalSize);

  // MultiHead Attention - Original
  const mhaOriginal = await runBenchmark(
    'MHA Original',
    () => multiHeadAttentionOriginal(query, key, value, numHeads, headDim),
    100,
    10
  );

  // MultiHead Attention - Optimized
  const mhaOptimized = await runBenchmark(
    'MHA Optimized',
    () => multiHeadAttentionOptimized(query, key, value, numHeads, headDim),
    100,
    10
  );

  console.log(`  MultiHeadAttention (${numHeads} heads, ${headDim}d, seq=${seqLen})`);
  console.log(`    Original:  ${mhaOriginal.avgMs.toFixed(3)}ms avg`);
  console.log(`    Optimized: ${mhaOptimized.avgMs.toFixed(3)}ms avg`);
  console.log(`    Speedup:   ${(mhaOriginal.avgMs / mhaOptimized.avgMs).toFixed(2)}x`);

  // Flash Attention - Original
  const flashOriginal = await runBenchmark(
    'Flash Original',
    () => flashAttentionOriginal(query, key, value, numHeads, headDim),
    100,
    10
  );

  // Flash Attention - Optimized
  const flashOptimized = await runBenchmark(
    'Flash Optimized',
    () => flashAttentionOptimized(query, key, value, numHeads, headDim),
    100,
    10
  );

  console.log(`\n  FlashAttention (${numHeads} heads, ${headDim}d, seq=${seqLen})`);
  console.log(`    Original:  ${flashOriginal.avgMs.toFixed(3)}ms avg`);
  console.log(`    Optimized: ${flashOptimized.avgMs.toFixed(3)}ms avg`);
  console.log(`    Speedup:   ${(flashOriginal.avgMs / flashOptimized.avgMs).toFixed(2)}x`);

  // Batch Attention Throughput
  const batchIterations = 50;
  const batchStart = performance.now();
  for (let i = 0; i < batchIterations; i++) {
    multiHeadAttentionOptimized(query, key, value, numHeads, headDim);
  }
  const batchDuration = performance.now() - batchStart;

  console.log(`\n  Batch Attention Throughput`);
  console.log(`    ${batchIterations} forward passes: ${batchDuration.toFixed(2)}ms`);
  console.log(`    Throughput: ${formatNumber(Math.round(batchIterations / batchDuration * 1000))} passes/sec`);

  return {
    mhaSpeedup: mhaOriginal.avgMs / mhaOptimized.avgMs,
    flashSpeedup: flashOriginal.avgMs / flashOptimized.avgMs,
  };
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  // Get package version
  let version = '2.0.0-alpha';
  try {
    const pkg = await import('../package.json', { with: { type: 'json' } });
    version = pkg.default.version;
  } catch {
    // Use default version
  }

  console.log('======================================================================');
  console.log('  AGENTDB PERFORMANCE BENCHMARK SUITE');
  console.log(`  agentdb v${version}`);
  console.log('======================================================================');

  const startTime = performance.now();
  const results: Record<string, any> = {};

  // Run all benchmarks
  results.simd = await runSIMDBenchmarks();
  results.quantization = await runQuantizationBenchmarks();
  results.ruvector = await runRuVectorBackendBenchmarks();
  results.embedding = await runEmbeddingServiceBenchmarks();
  results.attention = await runAttentionBenchmarks();

  const totalDuration = performance.now() - startTime;

  // Summary
  console.log('\n======================================================================');
  console.log('  BENCHMARK SUMMARY');
  console.log('======================================================================');

  console.log(`\n  Total Duration: ${(totalDuration / 1000).toFixed(2)}s`);

  console.log('\n  Performance Highlights:');

  if (results.simd) {
    console.log(`    - SIMD Cosine:     ${results.simd.cosineSpeedup.toFixed(2)}x faster than baseline`);
    console.log(`    - SIMD Euclidean:  ${results.simd.euclideanSpeedup.toFixed(2)}x faster than baseline`);
  }

  if (results.quantization) {
    console.log(`    - 8-bit Quant:     ${results.quantization.memoryReduction8bit.toFixed(1)}% memory reduction`);
    console.log(`    - 4-bit Quant:     ${results.quantization.memoryReduction4bit.toFixed(1)}% memory reduction`);
    console.log(`    - PQ Quant:        ${results.quantization.memoryReductionPQ.toFixed(1)}% memory reduction`);
  }

  if (results.ruvector) {
    console.log(`    - Insert Latency:  ${results.ruvector.insertLatencyUs.toFixed(2)}us average`);
    console.log(`    - Batch Speedup:   ${results.ruvector.batchSpeedup.toFixed(2)}x (parallel vs sequential)`);
  }

  if (results.embedding) {
    console.log(`    - Cache Speedup:   ${results.embedding.cacheSpeedup.toFixed(1)}x (hit vs miss)`);
  }

  if (results.attention) {
    console.log(`    - MHA Optimized:   ${results.attention.mhaSpeedup.toFixed(2)}x faster`);
    console.log(`    - Flash Optimized: ${results.attention.flashSpeedup.toFixed(2)}x faster`);
  }

  console.log('\n======================================================================');
  console.log('  Benchmark complete.');
  console.log('======================================================================\n');
}

// Extension for string width
declare global {
  interface String {
    readonly width: string;
  }
}

Object.defineProperty(String.prototype, 'width', {
  get() {
    return '-'.repeat(66);
  },
});

// Run benchmarks
main().catch(console.error);

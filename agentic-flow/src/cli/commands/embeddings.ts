/**
 * Embeddings CLI Commands
 *
 * Commands for managing ONNX embedding models:
 * - init: Download and initialize default model
 * - download: Download specific model
 * - list: List available models
 * - benchmark: Run embedding benchmarks
 */

import {
  downloadModel,
  listAvailableModels,
  getOptimizedEmbedder,
  cosineSimilarity,
  DEFAULT_CONFIG
} from '../../embeddings/index.js';

export async function handleEmbeddingsCommand(args: string[]): Promise<void> {
  const subcommand = args[0] || 'help';

  switch (subcommand) {
    case 'init':
      await handleInit(args.slice(1));
      break;
    case 'download':
      await handleDownload(args.slice(1));
      break;
    case 'list':
      handleList();
      break;
    case 'benchmark':
      await handleBenchmark(args.slice(1));
      break;
    case 'status':
      await handleStatus();
      break;
    case 'help':
    default:
      printHelp();
  }
}

async function handleInit(args: string[]): Promise<void> {
  const modelId = args[0] || DEFAULT_CONFIG.modelId;

  console.log('🚀 Initializing Agentic-Flow Embeddings\n');
  console.log(`Model: ${modelId}`);
  console.log(`Cache: ${DEFAULT_CONFIG.modelDir}`);
  console.log('');

  try {
    // Download model
    console.log('📥 Downloading model...');
    await downloadModel(modelId, DEFAULT_CONFIG.modelDir, (progress) => {
      const bar = '█'.repeat(Math.floor(progress.percent / 5)) + '░'.repeat(20 - Math.floor(progress.percent / 5));
      process.stdout.write(`\r   [${bar}] ${progress.percent.toFixed(1)}%`);
    });
    console.log('\n   ✓ Download complete\n');

    // Initialize embedder
    console.log('🔧 Initializing embedder...');
    const embedder = getOptimizedEmbedder({ modelId });
    await embedder.init();
    console.log('   ✓ Embedder ready\n');

    // Quick validation
    console.log('🧪 Validating...');
    const startTime = Date.now();
    const testEmb = await embedder.embed('Hello, world!');
    const latency = Date.now() - startTime;

    const norm = Math.sqrt(testEmb.reduce((s, v) => s + v * v, 0));
    console.log(`   ✓ Dimension: ${testEmb.length}`);
    console.log(`   ✓ Norm: ${norm.toFixed(4)}`);
    console.log(`   ✓ Latency: ${latency}ms\n`);

    console.log('✅ Embeddings initialized successfully!\n');
    console.log('Usage:');
    console.log('  import { getOptimizedEmbedder } from "agentic-flow/embeddings"');
    console.log('  const embedder = getOptimizedEmbedder();');
    console.log('  const embedding = await embedder.embed("Your text here");');

  } catch (error) {
    console.error('\n❌ Initialization failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

async function handleDownload(args: string[]): Promise<void> {
  const modelId = args[0];

  if (!modelId) {
    console.log('Available models:\n');
    handleList();
    console.log('\nUsage: agentic-flow embeddings download <model-id>');
    return;
  }

  console.log(`📥 Downloading ${modelId}...\n`);

  try {
    await downloadModel(modelId, DEFAULT_CONFIG.modelDir, (progress) => {
      const mb = (progress.bytesDownloaded / 1024 / 1024).toFixed(1);
      const totalMb = (progress.totalBytes / 1024 / 1024).toFixed(1);
      const bar = '█'.repeat(Math.floor(progress.percent / 5)) + '░'.repeat(20 - Math.floor(progress.percent / 5));
      process.stdout.write(`\r[${bar}] ${progress.percent.toFixed(1)}% (${mb}/${totalMb} MB)`);
    });
    console.log('\n\n✅ Download complete!');
  } catch (error) {
    console.error('\n❌ Download failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

function handleList(): void {
  const models = listAvailableModels();

  console.log('Available Embedding Models:\n');
  console.log('┌─────────────────────────┬───────────┬─────────┬───────────┬────────────┐');
  console.log('│ Model ID                │ Dimension │ Size    │ Quantized │ Downloaded │');
  console.log('├─────────────────────────┼───────────┼─────────┼───────────┼────────────┤');

  for (const model of models) {
    const id = model.id.padEnd(23);
    const dim = String(model.dimension).padEnd(9);
    const size = model.size.padEnd(7);
    const quant = (model.quantized ? 'Yes' : 'No').padEnd(9);
    const downloaded = model.downloaded ? '✓' : ' ';

    console.log(`│ ${id} │ ${dim} │ ${size} │ ${quant} │     ${downloaded}      │`);
  }

  console.log('└─────────────────────────┴───────────┴─────────┴───────────┴────────────┘');
  console.log('\nRecommended: all-MiniLM-L6-v2 (quantized, 23MB, best speed/quality)');
}

async function handleBenchmark(args: string[]): Promise<void> {
  const iterations = parseInt(args[0] || '100', 10);

  console.log('🏃 Running Embedding Benchmarks\n');
  console.log(`Iterations: ${iterations}\n`);

  const embedder = getOptimizedEmbedder();

  try {
    await embedder.init();
  } catch (error) {
    console.error('❌ Embedder not initialized. Run: agentic-flow embeddings init');
    process.exit(1);
  }

  // Warm-up
  console.log('Warming up...');
  for (let i = 0; i < 10; i++) {
    await embedder.embed(`Warm-up text ${i}`);
  }
  embedder.clearCache();

  // Benchmark single embedding (cold)
  console.log('\n📊 Single Embedding (cold cache):');
  const coldTimes: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await embedder.embed(`Benchmark text ${i} with unique content`);
    coldTimes.push(performance.now() - start);
  }
  embedder.clearCache();

  const coldAvg = coldTimes.reduce((a, b) => a + b, 0) / coldTimes.length;
  const coldP95 = coldTimes.sort((a, b) => a - b)[Math.floor(iterations * 0.95)];
  console.log(`   Average: ${coldAvg.toFixed(2)}ms`);
  console.log(`   P95: ${coldP95.toFixed(2)}ms`);

  // Benchmark cached embedding
  console.log('\n📊 Single Embedding (warm cache):');
  const testText = 'This is a cached benchmark text';
  await embedder.embed(testText);

  const warmTimes: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await embedder.embed(testText);
    warmTimes.push(performance.now() - start);
  }

  const warmAvg = warmTimes.reduce((a, b) => a + b, 0) / warmTimes.length;
  const warmP95 = warmTimes.sort((a, b) => a - b)[Math.floor(iterations * 0.95)];
  console.log(`   Average: ${warmAvg.toFixed(3)}ms`);
  console.log(`   P95: ${warmP95.toFixed(3)}ms`);
  console.log(`   Speedup: ${(coldAvg / warmAvg).toFixed(1)}x`);

  // Benchmark cosine similarity
  console.log('\n📊 Cosine Similarity:');
  const emb1 = await embedder.embed('First embedding');
  const emb2 = await embedder.embed('Second embedding');

  const simTimes: number[] = [];
  for (let i = 0; i < iterations * 10; i++) {
    const start = performance.now();
    cosineSimilarity(emb1, emb2);
    simTimes.push(performance.now() - start);
  }

  const simAvg = simTimes.reduce((a, b) => a + b, 0) / simTimes.length;
  console.log(`   Average: ${(simAvg * 1000).toFixed(2)}μs`);
  console.log(`   Ops/sec: ${(1000 / simAvg).toFixed(0)}`);

  // Benchmark batch embedding
  console.log('\n📊 Batch Embedding (10 texts):');
  embedder.clearCache();
  const batchTexts = Array.from({ length: 10 }, (_, i) => `Batch text number ${i}`);

  const batchTimes: number[] = [];
  for (let i = 0; i < iterations / 10; i++) {
    embedder.clearCache();
    const start = performance.now();
    await embedder.embedBatch(batchTexts.map((t, j) => `${t} iter ${i * 10 + j}`));
    batchTimes.push(performance.now() - start);
  }

  const batchAvg = batchTimes.reduce((a, b) => a + b, 0) / batchTimes.length;
  console.log(`   Average: ${batchAvg.toFixed(2)}ms`);
  console.log(`   Per embedding: ${(batchAvg / 10).toFixed(2)}ms`);

  console.log('\n✅ Benchmark complete!');
  console.log(`\nCache stats: ${embedder.getCacheStats().size}/${embedder.getCacheStats().maxSize} entries`);
}

async function handleStatus(): Promise<void> {
  console.log('📊 Embeddings Status\n');

  console.log(`Model directory: ${DEFAULT_CONFIG.modelDir}`);
  console.log(`Default model: ${DEFAULT_CONFIG.modelId}`);
  console.log(`Cache size: ${DEFAULT_CONFIG.cacheSize} entries`);
  console.log('');

  const models = listAvailableModels();
  const downloaded = models.filter(m => m.downloaded);

  console.log(`Downloaded models: ${downloaded.length}/${models.length}`);
  for (const model of downloaded) {
    console.log(`  ✓ ${model.id} (${model.dimension}d, ${model.size})`);
  }

  if (downloaded.length === 0) {
    console.log('  (none)\n');
    console.log('Run: agentic-flow embeddings init');
  }
}

function printHelp(): void {
  console.log(`
Embeddings Commands - ONNX model management for agentic-flow

USAGE:
  agentic-flow embeddings <command> [options]

COMMANDS:
  init [model]      Download and initialize embeddings (default: all-MiniLM-L6-v2)
  download <model>  Download a specific model
  list              List available models
  benchmark [n]     Run embedding benchmarks (default: 100 iterations)
  status            Show embeddings status

EXAMPLES:
  agentic-flow embeddings init
  agentic-flow embeddings download bge-small-en-v1.5
  agentic-flow embeddings benchmark 500

MODELS:
  all-MiniLM-L6-v2      384d, 23MB, quantized (recommended)
  all-MiniLM-L6-v2-full 384d, 91MB, full precision
  bge-small-en-v1.5     384d, 33MB, quantized
  gte-small             384d, 33MB, quantized

OPTIMIZATIONS:
  - LRU cache (256 entries, FNV-1a hash)
  - SIMD-friendly loop unrolling (4x)
  - Float32Array buffers (no GC pressure)
  - Pre-computed norms for similarity
`);
}

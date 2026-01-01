/**
 * Embeddings Module
 *
 * Optimized embedding generation for agentic-flow with:
 * - ONNX model download and caching
 * - LRU embedding cache (256 entries)
 * - SIMD-friendly vector operations
 * - Multiple model support
 */

export * from './optimized-embedder.js';

// Re-export key functions
export {
  OptimizedEmbedder,
  getOptimizedEmbedder,
  downloadModel,
  listAvailableModels,
  initEmbeddings,
  cosineSimilarity,
  euclideanDistance,
  normalizeVector,
  DEFAULT_CONFIG
} from './optimized-embedder.js';

// Re-export types
export type {
  EmbedderConfig,
  DownloadProgress
} from './optimized-embedder.js';

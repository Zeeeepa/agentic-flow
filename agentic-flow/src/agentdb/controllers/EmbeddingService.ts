/**
 * EmbeddingService - Text Embedding Generation
 *
 * Handles text-to-vector embedding generation using various models.
 * Supports both local (transformers.js) and remote (OpenAI, etc.) embeddings.
 * Uses global model cache to avoid repeated initialization overhead.
 */

import { getCachedOnnxEmbedder, getCachedTransformersPipeline } from '../../utils/model-cache.js';
import { suppressExperimentalWarnings } from '../../utils/suppress-warnings.js';

export interface EmbeddingConfig {
  model: string;
  dimension: number;
  provider: 'transformers' | 'openai' | 'onnx-wasm' | 'local';
  apiKey?: string;
}

export class EmbeddingService {
  private config: EmbeddingConfig;
  private pipeline: any; // transformers.js pipeline
  private onnxEmbedder: any; // ONNX WASM embedder
  private cache: Map<string, Float32Array>;
  private static globalInitialized = false;

  constructor(config: EmbeddingConfig) {
    this.config = config;
    this.cache = new Map();

    // Suppress experimental warnings once globally
    if (!EmbeddingService.globalInitialized) {
      suppressExperimentalWarnings();
      EmbeddingService.globalInitialized = true;
    }
  }

  /**
   * Initialize the embedding service (uses global model cache)
   */
  async initialize(): Promise<void> {
    if (this.config.provider === 'onnx-wasm') {
      // Use cached ONNX WASM embedder (avoids reload on each instance)
      try {
        this.onnxEmbedder = await getCachedOnnxEmbedder();
        if (!this.onnxEmbedder) {
          throw new Error('ONNX embedder not available');
        }
      } catch (error) {
        console.warn('ONNX WASM not available, falling back to transformers.js');
        this.config.provider = 'transformers';
      }
    }

    if (this.config.provider === 'transformers') {
      // Use cached transformers.js pipeline
      try {
        this.pipeline = await getCachedTransformersPipeline(
          'feature-extraction',
          this.config.model
        );
      } catch (error) {
        console.warn('Transformers.js not available, falling back to mock embeddings');
        this.pipeline = null;
      }
    }
  }

  /**
   * Generate embedding for text
   */
  async embed(text: string): Promise<Float32Array> {
    // Check cache
    const cacheKey = `${this.config.model}:${text}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    let embedding: Float32Array;

    if (this.config.provider === 'onnx-wasm' && this.onnxEmbedder) {
      // Use ONNX WASM (fastest, SIMD accelerated)
      const result = await this.onnxEmbedder.embed?.(text)
        || await this.onnxEmbedder.encode?.(text)
        || await this.onnxEmbedder.generate?.(text);
      embedding = result instanceof Float32Array ? result : new Float32Array(result);
    } else if (this.config.provider === 'transformers' && this.pipeline) {
      // Use transformers.js
      const output = await this.pipeline(text, { pooling: 'mean', normalize: true });
      embedding = new Float32Array(output.data);
    } else if (this.config.provider === 'openai' && this.config.apiKey) {
      // Use OpenAI API
      embedding = await this.embedOpenAI(text);
    } else {
      // Mock embedding for testing
      embedding = this.mockEmbedding(text);
    }

    // Cache result
    if (this.cache.size > 10000) {
      // Simple LRU: clear half the cache
      const keysToDelete = Array.from(this.cache.keys()).slice(0, 5000);
      keysToDelete.forEach(k => this.cache.delete(k));
    }
    this.cache.set(cacheKey, embedding);

    return embedding;
  }

  /**
   * Batch embed multiple texts
   */
  async embedBatch(texts: string[]): Promise<Float32Array[]> {
    return Promise.all(texts.map(text => this.embed(text)));
  }

  /**
   * Clear embedding cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  private async embedOpenAI(text: string): Promise<Float32Array> {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.config.model,
        input: text
      })
    });

    const data = await response.json();
    return new Float32Array(data.data[0].embedding);
  }

  private mockEmbedding(text: string): Float32Array {
    // Simple deterministic mock embedding for testing
    const embedding = new Float32Array(this.config.dimension);

    // Use simple hash-based generation
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = ((hash << 5) - hash) + text.charCodeAt(i);
      hash = hash & hash; // Convert to 32bit integer
    }

    // Fill embedding with pseudo-random values based on hash
    for (let i = 0; i < this.config.dimension; i++) {
      const seed = hash + i * 31;
      embedding[i] = Math.sin(seed) * Math.cos(seed * 0.5);
    }

    // Normalize
    let norm = 0;
    for (let i = 0; i < embedding.length; i++) {
      norm += embedding[i] * embedding[i];
    }
    norm = Math.sqrt(norm);

    for (let i = 0; i < embedding.length; i++) {
      embedding[i] /= norm;
    }

    return embedding;
  }
}

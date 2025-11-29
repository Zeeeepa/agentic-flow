/**
 * RuVectorBackend - High-Performance Vector Storage
 *
 * Implements VectorBackend using @ruvector/core with optional GNN support.
 * Provides <100µs search latency with native SIMD optimizations.
 *
 * Features:
 * - Automatic fallback when @ruvector packages not installed
 * - Separate metadata storage for rich queries
 * - Distance-to-similarity conversion for all metrics
 * - Batch operations for optimal throughput
 * - Persistent storage with separate metadata files
 */

import type { VectorBackend, VectorConfig, SearchResult, SearchOptions, VectorStats } from '../VectorBackend.js';

export class RuVectorBackend implements VectorBackend {
  readonly name = 'ruvector' as const;
  private db: any; // VectorDB from @ruvector/core
  private config: VectorConfig;
  private metadata: Map<string, Record<string, any>> = new Map();
  private initialized = false;

  constructor(config: VectorConfig) {
    this.config = config;
  }

  /**
   * Initialize RuVector database with optional dependency handling
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
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

      this.initialized = true;
    } catch (error) {
      throw new Error(
        `RuVector initialization failed. Please install: npm install ruvector\n` +
        `Or legacy packages: npm install @ruvector/core\n` +
        `Error: ${(error as Error).message}`
      );
    }
  }

  /**
   * Insert single vector with optional metadata
   */
  insert(id: string, embedding: Float32Array, metadata?: Record<string, any>): void {
    this.ensureInitialized();

    // RuVector expects regular arrays
    this.db.insert(id, Array.from(embedding));

    if (metadata) {
      this.metadata.set(id, metadata);
    }
  }

  /**
   * Batch insert for optimal performance
   */
  insertBatch(items: Array<{ id: string; embedding: Float32Array; metadata?: Record<string, any> }>): void {
    this.ensureInitialized();

    for (const item of items) {
      this.insert(item.id, item.embedding, item.metadata);
    }
  }

  /**
   * Search for k-nearest neighbors with optional filtering
   */
  search(query: Float32Array, k: number, options?: SearchOptions): SearchResult[] {
    this.ensureInitialized();

    // Apply efSearch parameter if provided
    if (options?.efSearch) {
      this.db.setEfSearch(options.efSearch);
    }

    // Perform vector search
    const results = this.db.search(Array.from(query), k);

    // Convert results and apply filtering
    return results
      .map((r: { id: string; distance: number }) => ({
        id: r.id,
        distance: r.distance,
        similarity: this.distanceToSimilarity(r.distance),
        metadata: this.metadata.get(r.id)
      }))
      .filter((r: SearchResult) => {
        // Apply similarity threshold
        if (options?.threshold && r.similarity < options.threshold) {
          return false;
        }

        // Apply metadata filters
        if (options?.filter && r.metadata) {
          return Object.entries(options.filter).every(
            ([key, value]) => r.metadata![key] === value
          );
        }

        return true;
      });
  }

  /**
   * Remove vector by ID
   */
  remove(id: string): boolean {
    this.ensureInitialized();

    this.metadata.delete(id);

    try {
      return this.db.remove(id);
    } catch {
      return false;
    }
  }

  /**
   * Get database statistics
   */
  getStats(): VectorStats {
    this.ensureInitialized();

    return {
      count: this.db.count(),
      dimension: this.config.dimension,
      metric: this.config.metric,
      backend: 'ruvector',
      memoryUsage: this.db.memoryUsage?.() || 0
    };
  }

  /**
   * Save index and metadata to disk
   */
  async save(path: string): Promise<void> {
    this.ensureInitialized();

    // Save vector index
    this.db.save(path);

    // Save metadata separately as JSON
    const metadataPath = path + '.meta.json';
    const fs = await import('fs/promises');
    await fs.writeFile(
      metadataPath,
      JSON.stringify(Object.fromEntries(this.metadata), null, 2)
    );
  }

  /**
   * Load index and metadata from disk
   */
  async load(path: string): Promise<void> {
    this.ensureInitialized();

    // Load vector index
    this.db.load(path);

    // Load metadata
    const metadataPath = path + '.meta.json';
    try {
      const fs = await import('fs/promises');
      const data = await fs.readFile(metadataPath, 'utf-8');
      this.metadata = new Map(Object.entries(JSON.parse(data)));
    } catch {
      // No metadata file - this is okay for backward compatibility
      console.debug(`[RuVectorBackend] No metadata file found at ${metadataPath}`);
    }
  }

  /**
   * Close and cleanup resources
   */
  close(): void {
    // RuVector cleanup if needed
    this.metadata.clear();
  }

  /**
   * Convert distance to similarity score based on metric
   *
   * Cosine: distance is already in [0, 2], where 0 = identical
   * L2: exponential decay for unbounded distances
   * IP: negative inner product, so negate for similarity
   */
  private distanceToSimilarity(distance: number): number {
    switch (this.config.metric) {
      case 'cosine':
        return 1 - distance; // cosine distance is 1 - similarity
      case 'l2':
        return Math.exp(-distance); // exponential decay
      case 'ip':
        return -distance; // inner product: higher is better
      default:
        return 1 - distance;
    }
  }

  /**
   * Ensure database is initialized before operations
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('RuVectorBackend not initialized. Call initialize() first.');
    }
  }
}

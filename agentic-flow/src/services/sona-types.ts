/**
 * TypeScript interfaces for SONA engine
 *
 * Replaces 'any' types with proper interfaces for type safety
 */

export interface SONAPattern {
  id: string;
  avgQuality: number;
  similarity: number;
  context?: string;
  embedding?: number[];
  route?: string;
}

export interface SONAStats {
  totalPatterns: number;
  avgQuality: number;
  trajectories: number;
  trajectoryUtilization: number;
  routes: Record<string, number>;
  qualityDistribution: {
    high: number;
    medium: number;
    low: number;
  };
}

export interface LearnResult {
  patternsLearned: number;
  quality: number;
  convergence: boolean;
  epochs: number;
}

export interface TrajectoryContext {
  route?: string;
  metadata: Record<string, string>;
}

/**
 * SONA Engine Interface
 *
 * Core methods for trajectory management and LoRA adaptation
 */
export interface SONAEngine {
  /**
   * Begin a new trajectory for learning
   * @param embedding - Initial embedding vector (should be 3072D)
   * @returns Trajectory ID
   */
  beginTrajectory(embedding: number[]): string;

  /**
   * Set the route (agent/task name) for a trajectory
   * @param id - Trajectory ID
   * @param route - Route name
   */
  setTrajectoryRoute(id: string, route: string): void;

  /**
   * Add context metadata to a trajectory
   * @param id - Trajectory ID
   * @param context - Context string (format: "key:value")
   */
  addTrajectoryContext(id: string, context: string): void;

  /**
   * Add a step to the trajectory with hidden states and attention
   * @param id - Trajectory ID
   * @param hiddenStates - Hidden layer activations
   * @param attentionWeights - Attention scores
   * @param quality - Quality score (0-1)
   */
  addTrajectoryStep(
    id: string,
    hiddenStates: number[],
    attentionWeights: number[],
    quality: number
  ): void;

  /**
   * End a trajectory and trigger LoRA update
   * @param id - Trajectory ID
   * @param finalQuality - Final quality score (0-1)
   */
  endTrajectory(id: string, finalQuality: number): void;

  /**
   * Find similar patterns using learned LoRA weights
   * @param queryEmbedding - Query vector
   * @param k - Number of results
   * @returns Array of patterns
   */
  findPatterns(queryEmbedding: number[], k: number): SONAPattern[];

  /**
   * Apply Micro-LoRA adaptation to an embedding
   * @param embedding - Input embedding
   * @returns Adapted embedding
   */
  applyMicroLora(embedding: number[]): number[];

  /**
   * Force a learning cycle to update LoRA weights
   * @returns Learning result
   */
  forceLearn(): LearnResult;

  /**
   * Get engine statistics
   * @returns Statistics object
   */
  getStats(): SONAStats;
}

/**
 * Validation utilities
 */
export class ValidationUtils {
  /**
   * Validate embedding dimensions
   */
  static validateEmbedding(
    embedding: number[],
    expectedDim: number = 3072,
    name: string = 'embedding'
  ): void {
    if (!embedding || !Array.isArray(embedding)) {
      throw new Error(`${name} must be an array, got ${typeof embedding}`);
    }

    if (embedding.length !== expectedDim) {
      throw new Error(
        `${name} must be ${expectedDim}D, got ${embedding.length}D`
      );
    }

    if (embedding.some(v => typeof v !== 'number' || !isFinite(v))) {
      throw new Error(`${name} contains invalid values (NaN or Infinity)`);
    }
  }

  /**
   * Validate quality score
   */
  static validateQuality(quality: number, name: string = 'quality'): void {
    if (typeof quality !== 'number' || !isFinite(quality)) {
      throw new Error(`${name} must be a finite number, got ${quality}`);
    }

    if (quality < 0 || quality > 1) {
      throw new Error(
        `${name} must be between 0 and 1, got ${quality}`
      );
    }
  }

  /**
   * Validate hidden states and attention weights
   */
  static validateStates(
    hiddenStates: number[],
    attention: number[],
    expectedDim: number = 3072
  ): void {
    this.validateEmbedding(hiddenStates, expectedDim, 'hiddenStates');
    this.validateEmbedding(attention, expectedDim, 'attention');
  }

  /**
   * Sanitize file path to prevent traversal attacks
   */
  static sanitizePath(inputPath: string, baseDir: string = process.cwd()): string {
    const path = require('path');

    // Resolve to absolute path
    const normalized = path.isAbsolute(inputPath)
      ? inputPath
      : path.join(baseDir, inputPath);

    const resolved = path.resolve(normalized);

    // Ensure path is within baseDir
    if (!resolved.startsWith(baseDir)) {
      throw new Error(
        `Path traversal detected: ${inputPath} resolves outside base directory`
      );
    }

    return resolved;
  }
}

/**
 * Custom Worker Configuration System
 *
 * Enables creation of custom workers by mixing and matching:
 * - Phases (discovery, analysis, pattern-matching, etc.)
 * - Capabilities (ONNX embeddings, VectorDB, SONA learning, etc.)
 * - Settings (timeouts, concurrency, output formats)
 */

import { WorkerTrigger, WorkerPriority, WorkerResults, WorkerContext } from './types.js';

// ============================================================================
// Phase System - Composable analysis phases
// ============================================================================

export type PhaseType =
  // Discovery phases
  | 'file-discovery'
  | 'pattern-discovery'
  | 'dependency-discovery'
  | 'api-discovery'
  // Analysis phases
  | 'static-analysis'
  | 'complexity-analysis'
  | 'security-analysis'
  | 'performance-analysis'
  | 'import-analysis'
  | 'type-analysis'
  // Pattern phases
  | 'pattern-extraction'
  | 'todo-extraction'
  | 'secret-detection'
  | 'code-smell-detection'
  // Build phases
  | 'graph-build'
  | 'call-graph'
  | 'dependency-graph'
  // Learning phases
  | 'vectorization'
  | 'embedding-generation'
  | 'pattern-storage'
  | 'sona-training'
  // Output phases
  | 'summarization'
  | 'report-generation'
  | 'indexing'
  // Custom
  | 'custom';

export interface PhaseConfig {
  /** Phase type */
  type: PhaseType;
  /** Phase name (for custom phases) */
  name?: string;
  /** Phase description */
  description?: string;
  /** Timeout in ms */
  timeout?: number;
  /** Options passed to phase executor */
  options?: Record<string, unknown>;
  /** Custom executor function (for 'custom' type) */
  executor?: (context: WorkerContext, options: Record<string, unknown>) => Promise<PhaseResult>;
}

export interface PhaseResult {
  success: boolean;
  data: Record<string, unknown>;
  files?: string[];
  patterns?: string[];
  bytes?: number;
  error?: string;
}

// ============================================================================
// Capability System - Enable/disable features
// ============================================================================

export interface CapabilityConfig {
  /** Use ONNX WASM for embeddings (faster, SIMD) */
  onnxEmbeddings?: boolean;
  /** Use VectorDB for pattern storage */
  vectorDb?: boolean;
  /** Use SONA for trajectory learning */
  sonaLearning?: boolean;
  /** Use ReasoningBank for memory */
  reasoningBank?: boolean;
  /** Use IntelligenceStore for patterns */
  intelligenceStore?: boolean;
  /** Enable real-time progress events */
  progressEvents?: boolean;
  /** Enable memory deposits */
  memoryDeposits?: boolean;
  /** Enable result persistence */
  persistResults?: boolean;
}

export const DEFAULT_CAPABILITIES: CapabilityConfig = {
  onnxEmbeddings: true,
  vectorDb: true,
  sonaLearning: true,
  reasoningBank: true,
  intelligenceStore: true,
  progressEvents: true,
  memoryDeposits: true,
  persistResults: true
};

// ============================================================================
// File Filter System
// ============================================================================

export interface FileFilterConfig {
  /** Glob patterns to include */
  include?: string[];
  /** Glob patterns to exclude */
  exclude?: string[];
  /** File extensions to include */
  extensions?: string[];
  /** Max file size in bytes */
  maxFileSize?: number;
  /** Max files to process */
  maxFiles?: number;
  /** Max directory depth */
  maxDepth?: number;
}

export const DEFAULT_FILE_FILTER: FileFilterConfig = {
  include: ['**/*.{ts,js,tsx,jsx,py,go,rs,java,c,cpp,h}'],
  exclude: ['node_modules/**', 'dist/**', '.git/**', 'vendor/**', '__pycache__/**'],
  extensions: ['ts', 'js', 'tsx', 'jsx', 'py', 'go', 'rs', 'java', 'c', 'cpp', 'h'],
  maxFileSize: 1024 * 1024, // 1MB
  maxFiles: 500,
  maxDepth: 10
};

// ============================================================================
// Output Configuration
// ============================================================================

export interface OutputConfig {
  /** Output format */
  format?: 'json' | 'summary' | 'detailed' | 'minimal';
  /** Include sample patterns in output */
  includeSamples?: boolean;
  /** Max samples to include */
  maxSamples?: number;
  /** Include file list in output */
  includeFileList?: boolean;
  /** Include timing metrics */
  includeMetrics?: boolean;
  /** Store output to file */
  outputPath?: string;
}

export const DEFAULT_OUTPUT: OutputConfig = {
  format: 'summary',
  includeSamples: true,
  maxSamples: 10,
  includeFileList: false,
  includeMetrics: true
};

// ============================================================================
// Custom Worker Definition
// ============================================================================

export interface CustomWorkerDefinition {
  /** Unique worker name (becomes trigger keyword) */
  name: string;
  /** Worker description */
  description: string;
  /** Trigger keywords (aliases) */
  triggers?: string[];
  /** Worker priority */
  priority?: WorkerPriority;
  /** Timeout in ms */
  timeout?: number;
  /** Cooldown between runs in ms */
  cooldown?: number;
  /** Topic extractor regex */
  topicExtractor?: string;
  /** Phases to execute in order */
  phases: PhaseConfig[];
  /** Capabilities to enable */
  capabilities?: Partial<CapabilityConfig>;
  /** File filter configuration */
  fileFilter?: Partial<FileFilterConfig>;
  /** Output configuration */
  output?: Partial<OutputConfig>;
  /** Custom metadata */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Worker Template Presets
// ============================================================================

export const WORKER_PRESETS: Record<string, Partial<CustomWorkerDefinition>> = {
  /** Quick file scan - fast discovery only */
  'quick-scan': {
    description: 'Quick file discovery and basic stats',
    priority: 'low',
    timeout: 30000,
    phases: [
      { type: 'file-discovery' },
      { type: 'summarization' }
    ],
    capabilities: {
      onnxEmbeddings: false,
      vectorDb: false,
      sonaLearning: false
    }
  },

  /** Deep analysis - comprehensive code analysis */
  'deep-analysis': {
    description: 'Comprehensive code analysis with all capabilities',
    priority: 'medium',
    timeout: 300000,
    phases: [
      { type: 'file-discovery' },
      { type: 'static-analysis' },
      { type: 'complexity-analysis' },
      { type: 'import-analysis' },
      { type: 'pattern-extraction' },
      { type: 'graph-build' },
      { type: 'vectorization' },
      { type: 'summarization' }
    ],
    capabilities: DEFAULT_CAPABILITIES
  },

  /** Security focused - security analysis only */
  'security-scan': {
    description: 'Security-focused analysis',
    priority: 'high',
    timeout: 120000,
    phases: [
      { type: 'file-discovery' },
      { type: 'security-analysis' },
      { type: 'secret-detection' },
      { type: 'dependency-discovery' },
      { type: 'report-generation' }
    ],
    capabilities: {
      onnxEmbeddings: false,
      persistResults: true
    }
  },

  /** Learning focused - pattern learning and storage */
  'learning': {
    description: 'Pattern learning and memory storage',
    priority: 'low',
    timeout: 180000,
    phases: [
      { type: 'file-discovery' },
      { type: 'pattern-extraction' },
      { type: 'embedding-generation' },
      { type: 'pattern-storage' },
      { type: 'sona-training' }
    ],
    capabilities: {
      onnxEmbeddings: true,
      vectorDb: true,
      sonaLearning: true,
      reasoningBank: true
    }
  },

  /** API documentation - API discovery and docs */
  'api-docs': {
    description: 'API endpoint discovery and documentation',
    priority: 'medium',
    timeout: 120000,
    phases: [
      { type: 'file-discovery', options: { include: ['**/*.{ts,js}'] } },
      { type: 'api-discovery' },
      { type: 'type-analysis' },
      { type: 'report-generation' }
    ],
    fileFilter: {
      include: ['**/routes/**', '**/api/**', '**/controllers/**', '**/handlers/**']
    }
  },

  /** Test coverage - test file analysis */
  'test-analysis': {
    description: 'Test file discovery and coverage analysis',
    priority: 'medium',
    timeout: 90000,
    phases: [
      { type: 'file-discovery', options: { pattern: '**/*.{test,spec}.{ts,js}' } },
      { type: 'static-analysis' },
      { type: 'pattern-extraction' },
      { type: 'summarization' }
    ],
    fileFilter: {
      include: ['**/*.test.ts', '**/*.spec.ts', '**/*.test.js', '**/*.spec.js', '**/test/**', '**/tests/**']
    }
  }
};

// ============================================================================
// Configuration File Format
// ============================================================================

export interface WorkerConfigFile {
  /** Version of config format */
  version: '1.0';
  /** Custom worker definitions */
  workers: CustomWorkerDefinition[];
  /** Global settings */
  settings?: {
    /** Default capabilities for all workers */
    defaultCapabilities?: Partial<CapabilityConfig>;
    /** Default file filter */
    defaultFileFilter?: Partial<FileFilterConfig>;
    /** Default output config */
    defaultOutput?: Partial<OutputConfig>;
    /** Max concurrent workers */
    maxConcurrent?: number;
    /** Enable debug logging */
    debug?: boolean;
  };
}

// ============================================================================
// Example Configuration
// ============================================================================

export const EXAMPLE_CONFIG: WorkerConfigFile = {
  version: '1.0',
  workers: [
    {
      name: 'auth-scanner',
      description: 'Scan for authentication patterns and security issues',
      triggers: ['auth-scan', 'scan-auth'],
      priority: 'high',
      timeout: 120000,
      topicExtractor: 'auth(?:entication)?\\s+(.+)',
      phases: [
        { type: 'file-discovery', options: { include: ['**/auth/**', '**/login/**', '**/session/**'] } },
        { type: 'pattern-extraction', options: { patterns: ['jwt', 'oauth', 'session', 'token'] } },
        { type: 'security-analysis' },
        { type: 'secret-detection' },
        { type: 'vectorization' },
        { type: 'report-generation' }
      ],
      capabilities: {
        onnxEmbeddings: true,
        vectorDb: true,
        persistResults: true
      },
      output: {
        format: 'detailed',
        includeSamples: true
      }
    },
    {
      name: 'perf-analyzer',
      description: 'Analyze code for performance bottlenecks',
      triggers: ['perf-scan', 'analyze-perf'],
      priority: 'medium',
      phases: [
        { type: 'file-discovery' },
        { type: 'complexity-analysis' },
        { type: 'performance-analysis' },
        { type: 'call-graph' },
        { type: 'summarization' }
      ]
    }
  ],
  settings: {
    defaultCapabilities: {
      onnxEmbeddings: true,
      progressEvents: true
    },
    maxConcurrent: 5,
    debug: false
  }
};

// ============================================================================
// Validation
// ============================================================================

export function validateWorkerDefinition(def: CustomWorkerDefinition): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!def.name || def.name.length < 2) {
    errors.push('Worker name must be at least 2 characters');
  }

  if (!/^[a-z][a-z0-9-]*$/.test(def.name)) {
    errors.push('Worker name must be lowercase alphanumeric with hyphens');
  }

  if (!def.description) {
    errors.push('Worker description is required');
  }

  if (!def.phases || def.phases.length === 0) {
    errors.push('At least one phase is required');
  }

  for (const phase of def.phases || []) {
    if (phase.type === 'custom' && !phase.executor && !phase.name) {
      errors.push('Custom phases require a name or executor');
    }
  }

  return { valid: errors.length === 0, errors };
}

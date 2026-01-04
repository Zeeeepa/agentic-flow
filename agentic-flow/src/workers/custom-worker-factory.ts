/**
 * Custom Worker Factory
 *
 * Creates worker implementations from CustomWorkerDefinition configs.
 * Handles loading config files, validating definitions, and registering
 * custom workers with the dispatch service.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import {
  CustomWorkerDefinition,
  WorkerConfigFile,
  validateWorkerDefinition,
  WORKER_PRESETS,
  DEFAULT_CAPABILITIES,
  DEFAULT_FILE_FILTER,
  DEFAULT_OUTPUT,
  CapabilityConfig,
  FileFilterConfig,
  OutputConfig
} from './custom-worker-config.js';
import { WorkerContext, WorkerResults } from './types.js';
import { executePhasePipeline, PhaseContext } from './phase-executors.js';

// ============================================================================
// Custom Worker Instance
// ============================================================================

export interface CustomWorkerInstance {
  /** Worker definition */
  definition: CustomWorkerDefinition;
  /** Merged capabilities */
  capabilities: CapabilityConfig;
  /** Merged file filter */
  fileFilter: FileFilterConfig;
  /** Merged output config */
  output: OutputConfig;
  /** Execute the worker */
  execute: (context: WorkerContext) => Promise<WorkerResults>;
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a worker instance from a definition
 */
export function createCustomWorker(
  definition: CustomWorkerDefinition,
  globalSettings?: {
    defaultCapabilities?: Partial<CapabilityConfig>;
    defaultFileFilter?: Partial<FileFilterConfig>;
    defaultOutput?: Partial<OutputConfig>;
  }
): CustomWorkerInstance {
  // Validate definition
  const validation = validateWorkerDefinition(definition);
  if (!validation.valid) {
    throw new Error(`Invalid worker definition: ${validation.errors.join(', ')}`);
  }

  // Merge capabilities
  const capabilities: CapabilityConfig = {
    ...DEFAULT_CAPABILITIES,
    ...globalSettings?.defaultCapabilities,
    ...definition.capabilities
  };

  // Merge file filter
  const fileFilter: FileFilterConfig = {
    ...DEFAULT_FILE_FILTER,
    ...globalSettings?.defaultFileFilter,
    ...definition.fileFilter
  };

  // Merge output config
  const output: OutputConfig = {
    ...DEFAULT_OUTPUT,
    ...globalSettings?.defaultOutput,
    ...definition.output
  };

  // Create executor
  const execute = async (context: WorkerContext): Promise<WorkerResults> => {
    const startTime = Date.now();

    try {
      // Execute phase pipeline
      const result = await executePhasePipeline(
        context,
        definition.phases,
        (phase, progress) => {
          // Progress callback for real-time updates
          if (capabilities.progressEvents) {
            console.log(`[${definition.name}] Phase: ${phase} (${progress}%)`);
          }
        }
      );

      // Build results
      const completedCount = Array.from(result.results.values()).filter(r => r?.success).length;
      const results: WorkerResults = {
        status: result.success ? 'complete' : 'failed',
        success: result.success,
        completedPhases: completedCount,
        totalPhases: definition.phases.length,
        memoryKeys: [],
        duration: Date.now() - startTime,
        data: buildResultsData(result.phaseContext, result.results, output)
      };

      // Handle learning capabilities
      if (capabilities.sonaLearning && result.phaseContext.patterns.length > 0) {
        results.data.sonaTrainingTriggered = true;
      }

      if (capabilities.vectorDb && result.phaseContext.patterns.length > 0) {
        results.data.vectorDbUpdated = true;
      }

      // Add timing
      results.data.executionTimeMs = Date.now() - startTime;
      results.data.phasesExecuted = definition.phases.length;

      // Add errors if any
      if (result.errors.length > 0) {
        results.data.errors = result.errors;
      }

      return results;
    } catch (error) {
      return {
        status: 'failed' as const,
        success: false,
        completedPhases: 0,
        totalPhases: definition.phases.length,
        memoryKeys: [],
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Worker execution failed',
        data: {
          error: error instanceof Error ? error.message : 'Worker execution failed',
          executionTimeMs: Date.now() - startTime
        }
      };
    }
  };

  return {
    definition,
    capabilities,
    fileFilter,
    output,
    execute
  };
}

/**
 * Build results data from phase context
 */
function buildResultsData(
  phaseContext: PhaseContext,
  phaseResults: Map<string, any>,
  outputConfig: OutputConfig
): Record<string, unknown> {
  const data: Record<string, unknown> = {
    files_analyzed: phaseContext.files.length,
    patterns_found: phaseContext.patterns.length,
    bytes_processed: phaseContext.bytes
  };

  // Add samples if configured
  if (outputConfig.includeSamples) {
    const maxSamples = outputConfig.maxSamples || 10;
    data.sample_patterns = phaseContext.patterns.slice(0, maxSamples);
  }

  // Add file list if configured
  if (outputConfig.includeFileList) {
    data.files = phaseContext.files;
  }

  // Add metrics if configured
  if (outputConfig.includeMetrics) {
    data.metrics = phaseContext.metrics;
  }

  // Add phase-specific data
  const phaseData: Record<string, unknown> = {};
  for (const [phase, result] of phaseResults) {
    if (result?.data) {
      phaseData[phase] = result.data;
    }
  }
  data.phaseResults = phaseData;

  return data;
}

// ============================================================================
// Create from Preset
// ============================================================================

/**
 * Create a worker from a preset
 */
export function createFromPreset(
  presetName: string,
  overrides?: Partial<CustomWorkerDefinition>
): CustomWorkerInstance {
  const preset = WORKER_PRESETS[presetName];
  if (!preset) {
    throw new Error(`Unknown preset: ${presetName}. Available: ${Object.keys(WORKER_PRESETS).join(', ')}`);
  }

  const definition: CustomWorkerDefinition = {
    name: overrides?.name || presetName,
    description: preset.description || `Worker from ${presetName} preset`,
    triggers: overrides?.triggers || [presetName],
    priority: preset.priority || 'medium',
    timeout: preset.timeout || 120000,
    phases: overrides?.phases || preset.phases || [],
    capabilities: { ...preset.capabilities, ...overrides?.capabilities },
    fileFilter: { ...preset.fileFilter, ...overrides?.fileFilter },
    output: { ...preset.output, ...overrides?.output },
    ...overrides
  };

  return createCustomWorker(definition);
}

// ============================================================================
// Config File Loading
// ============================================================================

const CONFIG_FILENAMES = [
  'workers.yaml',
  'workers.yml',
  'workers.json',
  '.agentic-flow/workers.yaml',
  '.agentic-flow/workers.yml',
  '.agentic-flow/workers.json'
];

/**
 * Load workers from a config file
 */
export async function loadWorkersFromConfig(
  configPath?: string
): Promise<CustomWorkerInstance[]> {
  let content: string;
  let actualPath: string;

  if (configPath) {
    actualPath = path.isAbsolute(configPath) ? configPath : path.join(process.cwd(), configPath);
    try {
      content = await fs.readFile(actualPath, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to read config file: ${actualPath}`);
    }
  } else {
    // Search for config file
    for (const filename of CONFIG_FILENAMES) {
      const tryPath = path.join(process.cwd(), filename);
      try {
        content = await fs.readFile(tryPath, 'utf-8');
        actualPath = tryPath;
        break;
      } catch {
        continue;
      }
    }
    if (!content!) {
      return [];
    }
  }

  // Parse config
  let config: WorkerConfigFile;
  if (actualPath!.endsWith('.json')) {
    config = JSON.parse(content);
  } else {
    config = parseYaml(content) as WorkerConfigFile;
  }

  // Validate version
  if (config.version !== '1.0') {
    console.warn(`Unknown config version: ${config.version}. Expected 1.0`);
  }

  // Create workers
  const workers: CustomWorkerInstance[] = [];
  for (const def of config.workers) {
    try {
      const worker = createCustomWorker(def, config.settings);
      workers.push(worker);
    } catch (error) {
      console.error(`Failed to create worker "${def.name}": ${error}`);
    }
  }

  return workers;
}

// ============================================================================
// Worker Registry Integration
// ============================================================================

export class CustomWorkerManager {
  private workers = new Map<string, CustomWorkerInstance>();
  private triggerMap = new Map<string, string>(); // trigger -> worker name

  /**
   * Register a custom worker
   */
  register(worker: CustomWorkerInstance): void {
    const name = worker.definition.name;
    this.workers.set(name, worker);

    // Register triggers
    this.triggerMap.set(name, name);
    for (const trigger of worker.definition.triggers || []) {
      this.triggerMap.set(trigger.toLowerCase(), name);
    }
  }

  /**
   * Create and register from preset
   */
  registerPreset(presetName: string, overrides?: Partial<CustomWorkerDefinition>): CustomWorkerInstance {
    const worker = createFromPreset(presetName, overrides);
    this.register(worker);
    return worker;
  }

  /**
   * Create and register from definition
   */
  registerDefinition(definition: CustomWorkerDefinition): CustomWorkerInstance {
    const worker = createCustomWorker(definition);
    this.register(worker);
    return worker;
  }

  /**
   * Load and register from config file
   */
  async loadFromConfig(configPath?: string): Promise<number> {
    const workers = await loadWorkersFromConfig(configPath);
    workers.forEach(w => this.register(w));
    return workers.length;
  }

  /**
   * Get worker by name or trigger
   */
  get(nameOrTrigger: string): CustomWorkerInstance | undefined {
    const key = nameOrTrigger.toLowerCase();
    const name = this.triggerMap.get(key);
    return name ? this.workers.get(name) : undefined;
  }

  /**
   * Check if a trigger matches a custom worker
   */
  matchesTrigger(input: string): string | undefined {
    const lower = input.toLowerCase();
    for (const [trigger, name] of this.triggerMap) {
      if (lower.includes(trigger)) {
        return name;
      }
    }
    return undefined;
  }

  /**
   * List all registered workers
   */
  list(): CustomWorkerInstance[] {
    return Array.from(this.workers.values());
  }

  /**
   * List available presets
   */
  listPresets(): string[] {
    return Object.keys(WORKER_PRESETS);
  }

  /**
   * Get preset definition
   */
  getPreset(name: string): Partial<CustomWorkerDefinition> | undefined {
    return WORKER_PRESETS[name];
  }

  /**
   * Execute a custom worker
   */
  async execute(nameOrTrigger: string, context: WorkerContext): Promise<WorkerResults> {
    const worker = this.get(nameOrTrigger);
    if (!worker) {
      return {
        status: 'failed' as const,
        success: false,
        completedPhases: 0,
        totalPhases: 0,
        memoryKeys: [],
        duration: 0,
        error: `Custom worker not found: ${nameOrTrigger}`,
        data: { error: `Custom worker not found: ${nameOrTrigger}` }
      };
    }

    return worker.execute(context);
  }

  /**
   * Generate example config file
   */
  generateExampleConfig(): string {
    const example: WorkerConfigFile = {
      version: '1.0',
      workers: [
        {
          name: 'my-scanner',
          description: 'Custom code scanner',
          triggers: ['scan-my'],
          priority: 'medium',
          timeout: 120000,
          phases: [
            { type: 'file-discovery' },
            { type: 'pattern-extraction' },
            { type: 'security-analysis' },
            { type: 'summarization' }
          ],
          capabilities: {
            onnxEmbeddings: true,
            vectorDb: true
          },
          output: {
            format: 'detailed',
            includeSamples: true
          }
        }
      ],
      settings: {
        defaultCapabilities: {
          progressEvents: true
        },
        maxConcurrent: 3,
        debug: false
      }
    };

    return `# Custom Workers Configuration
# Save as workers.yaml or .agentic-flow/workers.yaml

${stringifyYaml(example)}`;
  }
}

// Singleton instance
export const customWorkerManager = new CustomWorkerManager();

// ============================================================================
// CLI Helper Functions
// ============================================================================

export function formatWorkerInfo(worker: CustomWorkerInstance): string {
  const def = worker.definition;
  const lines = [
    `Name: ${def.name}`,
    `Description: ${def.description}`,
    `Triggers: ${[def.name, ...(def.triggers || [])].join(', ')}`,
    `Priority: ${def.priority || 'medium'}`,
    `Timeout: ${(def.timeout || 120000) / 1000}s`,
    `Phases: ${def.phases.map(p => p.type).join(' → ')}`,
    '',
    'Capabilities:',
    ...Object.entries(worker.capabilities)
      .filter(([_, v]) => v)
      .map(([k]) => `  ✓ ${k}`)
  ];

  return lines.join('\n');
}

export function formatPresetList(): string {
  const lines = ['Available Presets:', ''];

  for (const [name, preset] of Object.entries(WORKER_PRESETS)) {
    lines.push(`  ${name}`);
    lines.push(`    ${preset.description}`);
    lines.push(`    Phases: ${preset.phases?.map(p => p.type).join(' → ') || 'none'}`);
    lines.push('');
  }

  return lines.join('\n');
}

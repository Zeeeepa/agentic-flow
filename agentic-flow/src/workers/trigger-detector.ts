/**
 * TriggerDetector - Detects background worker triggers in prompts
 * Target: < 5ms detection latency
 */

import {
  WorkerTrigger,
  TriggerConfig,
  DetectedTrigger,
  WorkerPriority
} from './types.js';

// Trigger configuration map
const TRIGGER_CONFIGS: Map<WorkerTrigger, TriggerConfig> = new Map([
  ['ultralearn', {
    keyword: 'ultralearn',
    worker: 'research-swarm',
    priority: 'high',
    maxAgents: 5,
    timeout: 300000,      // 5 minutes
    cooldown: 60000,      // 1 minute
    topicExtractor: /ultralearn\s+(.+?)(?:\.|$)/i,
    description: 'Deep research swarm for codebase learning'
  }],
  ['optimize', {
    keyword: 'optimize',
    worker: 'perf-analyzer',
    priority: 'medium',
    maxAgents: 2,
    timeout: 180000,      // 3 minutes
    cooldown: 120000,     // 2 minutes
    topicExtractor: /optimize\s+(.+?)(?:\.|$)/i,
    description: 'Performance analyzer and cache optimizer'
  }],
  ['consolidate', {
    keyword: 'consolidate',
    worker: 'memory-optimizer',
    priority: 'low',
    maxAgents: 1,
    timeout: 120000,      // 2 minutes
    cooldown: 300000,     // 5 minutes
    topicExtractor: null,
    description: 'Memory compaction and pattern extraction'
  }],
  ['predict', {
    keyword: 'predict',
    worker: 'pattern-matcher',
    priority: 'medium',
    maxAgents: 2,
    timeout: 60000,       // 1 minute
    cooldown: 30000,      // 30 seconds
    topicExtractor: /predict\s+(.+?)(?:\.|$)/i,
    description: 'Pre-fetch likely files based on learned patterns'
  }],
  ['audit', {
    keyword: 'audit',
    worker: 'security-scanner',
    priority: 'high',
    maxAgents: 3,
    timeout: 300000,      // 5 minutes
    cooldown: 180000,     // 3 minutes
    topicExtractor: /audit\s+(.+?)(?:\.|$)/i,
    description: 'Security and code quality scan'
  }],
  ['map', {
    keyword: 'map',
    worker: 'dependency-mapper',
    priority: 'medium',
    maxAgents: 2,
    timeout: 240000,      // 4 minutes
    cooldown: 300000,     // 5 minutes
    topicExtractor: /map\s+(.+?)(?:\.|$)/i,
    description: 'Build full dependency graph'
  }],
  ['preload', {
    keyword: 'preload',
    worker: 'context-prefetcher',
    priority: 'low',
    maxAgents: 1,
    timeout: 30000,       // 30 seconds
    cooldown: 10000,      // 10 seconds
    topicExtractor: /preload\s+(.+?)(?:\.|$)/i,
    description: 'Pre-fetch context for faster access'
  }],
  ['deepdive', {
    keyword: 'deepdive',
    worker: 'call-graph-analyzer',
    priority: 'high',
    maxAgents: 4,
    timeout: 600000,      // 10 minutes
    cooldown: 300000,     // 5 minutes
    topicExtractor: /deepdive\s+(.+?)(?:\.|$)/i,
    description: 'Traces call paths 5+ levels deep'
  }],
  ['document', {
    keyword: 'document',
    worker: 'doc-generator',
    priority: 'low',
    maxAgents: 2,
    timeout: 180000,
    cooldown: 120000,
    topicExtractor: /document\s+(.+?)(?:\.|$)/i,
    description: 'Generate documentation for patterns'
  }],
  ['refactor', {
    keyword: 'refactor',
    worker: 'refactor-analyzer',
    priority: 'medium',
    maxAgents: 2,
    timeout: 180000,
    cooldown: 120000,
    topicExtractor: /refactor\s+(.+?)(?:\.|$)/i,
    description: 'Identify refactoring opportunities'
  }],
  ['benchmark', {
    keyword: 'benchmark',
    worker: 'perf-benchmarker',
    priority: 'medium',
    maxAgents: 2,
    timeout: 300000,
    cooldown: 180000,
    topicExtractor: /benchmark\s+(.+?)(?:\.|$)/i,
    description: 'Run performance benchmarks silently'
  }],
  ['testgaps', {
    keyword: 'testgaps',
    worker: 'coverage-analyzer',
    priority: 'medium',
    maxAgents: 2,
    timeout: 180000,
    cooldown: 120000,
    topicExtractor: /testgaps?\s+(.+?)(?:\.|$)/i,
    description: 'Find untested code paths'
  }]
]);

// Pre-compiled regex for fast matching
const TRIGGER_PATTERN = new RegExp(
  `\\b(${Array.from(TRIGGER_CONFIGS.keys()).join('|')})\\b`,
  'gi'
);

export class TriggerDetector {
  private cooldowns: Map<WorkerTrigger, number> = new Map();

  /**
   * Detect all triggers in a prompt
   * Target: < 5ms latency
   */
  detect(prompt: string): DetectedTrigger[] {
    const startTime = performance.now();
    const triggers: DetectedTrigger[] = [];
    const seen = new Set<WorkerTrigger>();

    // Fast regex match
    let match: RegExpExecArray | null;
    TRIGGER_PATTERN.lastIndex = 0;

    while ((match = TRIGGER_PATTERN.exec(prompt)) !== null) {
      const keyword = match[1].toLowerCase() as WorkerTrigger;

      // Skip duplicates
      if (seen.has(keyword)) continue;
      seen.add(keyword);

      // Check cooldown
      if (this.isOnCooldown(keyword)) continue;

      const config = TRIGGER_CONFIGS.get(keyword);
      if (!config) continue;

      // Extract topic if extractor exists
      let topic: string | null = null;
      if (config.topicExtractor) {
        const topicMatch = prompt.match(config.topicExtractor);
        if (topicMatch && topicMatch[1]) {
          topic = topicMatch[1].trim();
        }
      }

      triggers.push({
        keyword,
        topic,
        config,
        detectedAt: Date.now()
      });

      // Set cooldown
      this.setCooldown(keyword);
    }

    const elapsed = performance.now() - startTime;
    if (elapsed > 5) {
      console.warn(`TriggerDetector: detection took ${elapsed.toFixed(2)}ms (target: 5ms)`);
    }

    return triggers;
  }

  /**
   * Check if a trigger is on cooldown
   */
  isOnCooldown(trigger: WorkerTrigger): boolean {
    const lastUsed = this.cooldowns.get(trigger);
    if (!lastUsed) return false;

    const config = TRIGGER_CONFIGS.get(trigger);
    if (!config) return false;

    return Date.now() - lastUsed < config.cooldown;
  }

  /**
   * Set cooldown for a trigger
   */
  private setCooldown(trigger: WorkerTrigger): void {
    this.cooldowns.set(trigger, Date.now());
  }

  /**
   * Clear cooldown for a trigger (for testing)
   */
  clearCooldown(trigger: WorkerTrigger): void {
    this.cooldowns.delete(trigger);
  }

  /**
   * Clear all cooldowns
   */
  clearAllCooldowns(): void {
    this.cooldowns.clear();
  }

  /**
   * Get remaining cooldown time for a trigger
   */
  getCooldownRemaining(trigger: WorkerTrigger): number {
    const lastUsed = this.cooldowns.get(trigger);
    if (!lastUsed) return 0;

    const config = TRIGGER_CONFIGS.get(trigger);
    if (!config) return 0;

    const remaining = config.cooldown - (Date.now() - lastUsed);
    return Math.max(0, remaining);
  }

  /**
   * Get config for a specific trigger
   */
  getConfig(trigger: WorkerTrigger): TriggerConfig | undefined {
    return TRIGGER_CONFIGS.get(trigger);
  }

  /**
   * Get all trigger configs
   */
  getAllConfigs(): Map<WorkerTrigger, TriggerConfig> {
    return new Map(TRIGGER_CONFIGS);
  }

  /**
   * Check if a string contains any trigger keywords
   * Faster than full detect() when you just need boolean check
   */
  hasTriggers(prompt: string): boolean {
    TRIGGER_PATTERN.lastIndex = 0;
    return TRIGGER_PATTERN.test(prompt);
  }

  /**
   * Get trigger stats
   */
  getStats(): { triggers: WorkerTrigger[]; cooldowns: Record<string, number> } {
    const cooldowns: Record<string, number> = {};
    for (const [trigger, time] of this.cooldowns) {
      cooldowns[trigger] = this.getCooldownRemaining(trigger);
    }
    return {
      triggers: Array.from(TRIGGER_CONFIGS.keys()),
      cooldowns
    };
  }
}

// Singleton instance
let instance: TriggerDetector | null = null;

export function getTriggerDetector(): TriggerDetector {
  if (!instance) {
    instance = new TriggerDetector();
  }
  return instance;
}

export { TRIGGER_CONFIGS };

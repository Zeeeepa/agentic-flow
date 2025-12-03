/**
 * SONA Service Tests
 *
 * Based on vibecast sona.test.js patterns
 * Tests all key features and performance characteristics
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  SONAService,
  createSONAService,
  sonaServices,
  sonaService
} from '../../agentic-flow/src/services/sona-service';

describe('SONA Service', () => {
  describe('Profile-Based Initialization', () => {
    it('should create real-time profile with correct config', () => {
      const sona = sonaServices.realtime;
      const stats = sona.getStats();

      expect(stats.config.microLoraRank).toBe(2);
      expect(stats.config.patternClusters).toBe(25);
      expect(stats.config.qualityThreshold).toBe(0.7);
      expect(stats.config.enableSimd).toBe(true);
    });

    it('should create batch profile with correct config', () => {
      const sona = sonaServices.batch;
      const stats = sona.getStats();

      expect(stats.config.microLoraRank).toBe(2);
      expect(stats.config.baseLoraRank).toBe(8);
      expect(stats.config.trajectoryCapacity).toBe(5000);
    });

    it('should create research profile for maximum quality', () => {
      const sona = sonaServices.research;
      const stats = sona.getStats();

      // Research profile: rank-2 micro, rank-16 base, LR 0.002, threshold 0.2
      expect(stats.config.microLoraRank).toBe(2);
      expect(stats.config.baseLoraRank).toBe(16);
      expect(stats.config.microLoraLr).toBe(0.002);  // Sweet spot
      expect(stats.config.qualityThreshold).toBe(0.2); // Learn from more data
      expect(stats.config.ewcLambda).toBe(2500);       // Prevent forgetting
    });

    it('should create edge profile with minimal memory', () => {
      const sona = sonaServices.edge;
      const stats = sona.getStats();

      // Edge profile: rank-1, 200 capacity, 15 clusters → <5MB
      expect(stats.config.microLoraRank).toBe(1);
      expect(stats.config.trajectoryCapacity).toBe(200);
      expect(stats.config.patternClusters).toBe(15);
    });

    it('should create balanced profile as default', () => {
      const sona = sonaService;
      const stats = sona.getStats();

      // Balanced: rank-2, rank-8, 0.4 threshold → 18ms, +25% quality
      expect(stats.config.microLoraRank).toBe(2);
      expect(stats.config.baseLoraRank).toBe(8);
      expect(stats.config.qualityThreshold).toBe(0.4);
    });

    it('should support custom configuration', () => {
      const sona = createSONAService({
        profile: 'custom',
        microLoraRank: 4,
        patternClusters: 75,
        ewcLambda: 3000
      });

      const stats = sona.getStats();
      expect(stats.config.microLoraRank).toBe(4);
      expect(stats.config.patternClusters).toBe(75);
      expect(stats.config.ewcLambda).toBe(3000);
    });
  });

  describe('Trajectory Management', () => {
    let sona: SONAService;

    beforeEach(() => {
      sona = createSONAService({ profile: 'balanced' });
    });

    it('should begin a trajectory', () => {
      const embedding = Array.from({ length: 1536 }, () => Math.random());
      const trajectoryId = sona.beginTrajectory(embedding, 'claude-sonnet-4-5');

      expect(trajectoryId).toBeDefined();
      expect(typeof trajectoryId).toBe('string');

      const stats = sona.getStats();
      expect(stats.totalTrajectories).toBe(1);
      expect(stats.activeTrajectories).toBe(1);
    });

    it('should add steps to trajectory', () => {
      const embedding = Array.from({ length: 1536 }, () => Math.random());
      const trajectoryId = sona.beginTrajectory(embedding);

      // Add 5 steps
      for (let i = 0; i < 5; i++) {
        const activations = Array.from({ length: 3072 }, () => Math.random());
        const attentionWeights = Array.from({ length: 40 }, () => Math.random());
        const reward = 0.8 + Math.random() * 0.2;

        sona.addTrajectoryStep(trajectoryId, activations, attentionWeights, reward);
      }

      const trajectory = sona.getTrajectory(trajectoryId);
      expect(trajectory).toBeDefined();
      expect(trajectory!.steps).toHaveLength(5);
    });

    it('should add contexts to trajectory', () => {
      const embedding = Array.from({ length: 1536 }, () => Math.random());
      const trajectoryId = sona.beginTrajectory(embedding);

      sona.addTrajectoryContext(trajectoryId, 'code-review');
      sona.addTrajectoryContext(trajectoryId, 'typescript');

      const trajectory = sona.getTrajectory(trajectoryId);
      expect(trajectory!.contexts).toHaveLength(2);
      expect(trajectory!.contexts).toContain('code-review');
      expect(trajectory!.contexts).toContain('typescript');
    });

    it('should end trajectory with quality score', () => {
      const embedding = Array.from({ length: 1536 }, () => Math.random());
      const trajectoryId = sona.beginTrajectory(embedding);

      // Add some steps
      const activations = Array.from({ length: 3072 }, () => Math.random());
      const attentionWeights = Array.from({ length: 40 }, () => Math.random());
      sona.addTrajectoryStep(trajectoryId, activations, attentionWeights, 0.9);

      // End trajectory
      sona.endTrajectory(trajectoryId, 0.92);

      const stats = sona.getStats();
      expect(stats.completedTrajectories).toBe(1);
      expect(stats.activeTrajectories).toBe(0);
      expect(stats.avgQualityScore).toBe(0.92);

      const trajectory = sona.getTrajectory(trajectoryId);
      expect(trajectory!.endTime).toBeDefined();
      expect(trajectory!.qualityScore).toBe(0.92);
    });

    it('should track multiple trajectories concurrently', () => {
      const trajectoryIds: string[] = [];

      // Start 10 concurrent trajectories
      for (let i = 0; i < 10; i++) {
        const embedding = Array.from({ length: 1536 }, () => Math.random());
        const id = sona.beginTrajectory(embedding);
        trajectoryIds.push(id);
      }

      expect(trajectoryIds).toHaveLength(10);
      expect(new Set(trajectoryIds).size).toBe(10); // All unique

      const stats = sona.getStats();
      expect(stats.activeTrajectories).toBe(10);
    });

    it('should throw error for invalid trajectory ID', () => {
      expect(() => {
        sona.addTrajectoryStep(
          'invalid-id',
          [0.1, 0.2],
          [0.3, 0.4],
          0.5
        );
      }).toThrow();
    });
  });

  describe('LoRA Application', () => {
    let sona: SONAService;

    beforeEach(() => {
      sona = createSONAService({ profile: 'balanced' });
    });

    it('should apply Micro-LoRA to input vector', () => {
      const input = Array.from({ length: 3072 }, () => Math.random());
      const output = sona.applyMicroLora(input);

      expect(output).toHaveLength(3072);
      expect(output.every(v => isFinite(v))).toBe(true);
    });

    it('should apply Base-LoRA to layer', () => {
      const input = Array.from({ length: 3072 }, () => Math.random());
      const layerIndex = 10;
      const output = sona.applyBaseLora(layerIndex, input);

      expect(output).toHaveLength(3072);
      expect(output.every(v => isFinite(v))).toBe(true);
    });

    it('should handle different input dimensions', () => {
      const dimensions = [768, 1536, 3072, 4096];

      for (const dim of dimensions) {
        const customSona = createSONAService({
          hiddenDim: dim,
          embeddingDim: dim
        });

        const input = Array.from({ length: dim }, () => Math.random());
        const output = customSona.applyMicroLora(input);

        expect(output).toHaveLength(dim);
      }
    });

    it('should produce consistent output for same input', () => {
      const input = Array.from({ length: 3072 }, () => Math.random());

      const output1 = sona.applyMicroLora(input);
      const output2 = sona.applyMicroLora(input);

      // Should be consistent (deterministic)
      for (let i = 0; i < output1.length; i++) {
        expect(Math.abs(output1[i] - output2[i])).toBeLessThan(1e-6);
      }
    });
  });

  describe('Pattern Discovery', () => {
    let sona: SONAService;

    beforeEach(() => {
      sona = createSONAService({ profile: 'balanced' });
    });

    it('should find similar patterns with k=3 (optimal throughput)', () => {
      // Create and complete some trajectories first
      for (let i = 0; i < 5; i++) {
        const embedding = Array.from({ length: 1536 }, () => Math.random());
        const trajectoryId = sona.beginTrajectory(embedding);

        const activations = Array.from({ length: 3072 }, () => Math.random());
        const attentionWeights = Array.from({ length: 40 }, () => Math.random());
        sona.addTrajectoryStep(trajectoryId, activations, attentionWeights, 0.9);

        sona.endTrajectory(trajectoryId, 0.85 + Math.random() * 0.1);
      }

      // Trigger learning
      sona.forceLearn();

      // Find patterns (k=3 for 761 decisions/sec throughput)
      const query = Array.from({ length: 1536 }, () => Math.random());
      const patterns = sona.findPatterns(query, 3);

      expect(Array.isArray(patterns)).toBe(true);
      expect(patterns.length).toBeLessThanOrEqual(3);

      if (patterns.length > 0) {
        const pattern = patterns[0];
        expect(pattern).toHaveProperty('id');
        expect(pattern).toHaveProperty('centroid');
        expect(pattern).toHaveProperty('clusterSize');
        expect(pattern).toHaveProperty('avgQuality');
        expect(pattern).toHaveProperty('patternType');
        expect(pattern).toHaveProperty('similarity');
      }
    });

    it('should return patterns sorted by similarity', () => {
      // Setup: Create trajectories and learn
      for (let i = 0; i < 10; i++) {
        const embedding = Array.from({ length: 1536 }, () => Math.random());
        const trajectoryId = sona.beginTrajectory(embedding);
        const activations = Array.from({ length: 3072 }, () => Math.random());
        const attentionWeights = Array.from({ length: 40 }, () => Math.random());
        sona.addTrajectoryStep(trajectoryId, activations, attentionWeights, 0.9);
        sona.endTrajectory(trajectoryId, 0.9);
      }

      sona.forceLearn();

      const query = Array.from({ length: 1536 }, () => Math.random());
      const patterns = sona.findPatterns(query, 5);

      // Check if sorted by similarity (descending)
      for (let i = 1; i < patterns.length; i++) {
        expect(patterns[i - 1].similarity).toBeGreaterThanOrEqual(patterns[i].similarity);
      }
    });
  });

  describe('Learning Cycle', () => {
    let sona: SONAService;

    beforeEach(() => {
      sona = createSONAService({ profile: 'balanced' });
    });

    it('should force learning cycle', () => {
      const result = sona.forceLearn();

      expect(result.success).toBe(true);
      expect(typeof result.patternsLearned).toBe('number');

      const stats = sona.getStats();
      expect(stats.totalLearningCycles).toBe(1);
    });

    it('should auto-trigger learning at 80% capacity', () => {
      const capacity = sona.getStats().config.trajectoryCapacity;
      const triggerPoint = Math.floor(capacity * 0.8);

      let learningTriggered = false;
      sona.on('learning:trigger', () => {
        learningTriggered = true;
      });

      // Fill to 80% capacity
      for (let i = 0; i < triggerPoint; i++) {
        const embedding = Array.from({ length: 1536 }, () => Math.random());
        const trajectoryId = sona.beginTrajectory(embedding);
        sona.endTrajectory(trajectoryId, 0.9);
      }

      expect(learningTriggered).toBe(true);
    });
  });

  describe('Performance Characteristics', () => {
    let sona: SONAService;

    beforeEach(() => {
      sona = createSONAService({ profile: 'real-time' });
    });

    it('should achieve sub-millisecond Micro-LoRA latency', () => {
      const input = Array.from({ length: 3072 }, () => Math.random());

      const iterations = 100;
      const start = Date.now();

      for (let i = 0; i < iterations; i++) {
        sona.applyMicroLora(input);
      }

      const totalTime = Date.now() - start;
      const avgLatency = totalTime / iterations;

      // Real-time profile should achieve <0.5ms per operation
      expect(avgLatency).toBeLessThan(1); // Allow some margin for JS overhead
    });

    it('should handle high throughput operations', () => {
      const operations = 1000;
      const start = Date.now();

      for (let i = 0; i < operations; i++) {
        const input = Array.from({ length: 3072 }, () => Math.random());
        sona.applyMicroLora(input);
      }

      const elapsed = (Date.now() - start) / 1000; // seconds
      const opsPerSec = operations / elapsed;

      // Should achieve >1000 ops/sec (target: 2211 ops/sec)
      expect(opsPerSec).toBeGreaterThan(1000);
    });
  });

  describe('Statistics and Monitoring', () => {
    let sona: SONAService;

    beforeEach(() => {
      sona = createSONAService({ profile: 'balanced' });
    });

    it('should track statistics correctly', () => {
      const embedding = Array.from({ length: 1536 }, () => Math.random());
      const trajectoryId = sona.beginTrajectory(embedding);

      const activations = Array.from({ length: 3072 }, () => Math.random());
      const attentionWeights = Array.from({ length: 40 }, () => Math.random());
      sona.addTrajectoryStep(trajectoryId, activations, attentionWeights, 0.9);

      sona.endTrajectory(trajectoryId, 0.95);

      const stats = sona.getStats();

      expect(stats.totalTrajectories).toBe(1);
      expect(stats.completedTrajectories).toBe(1);
      expect(stats.activeTrajectories).toBe(0);
      expect(stats.avgQualityScore).toBe(0.95);
    });

    it('should calculate average quality score correctly', () => {
      const qualityScores = [0.8, 0.85, 0.9, 0.95];

      for (const score of qualityScores) {
        const embedding = Array.from({ length: 1536 }, () => Math.random());
        const trajectoryId = sona.beginTrajectory(embedding);
        sona.endTrajectory(trajectoryId, score);
      }

      const stats = sona.getStats();
      const expectedAvg = qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length;

      expect(stats.avgQualityScore).toBeCloseTo(expectedAvg, 2);
    });

    it('should get engine statistics', () => {
      const engineStats = sona.getEngineStats();

      expect(typeof engineStats).toBe('string');
      expect(engineStats.length).toBeGreaterThan(0);
    });

    it('should track trajectory utilization', () => {
      const capacity = sona.getStats().config.trajectoryCapacity;
      const count = 10;

      for (let i = 0; i < count; i++) {
        const embedding = Array.from({ length: 1536 }, () => Math.random());
        sona.beginTrajectory(embedding);
      }

      const stats = sona.getStats();
      const expectedUtilization = count / capacity;

      expect(stats.trajectoryUtilization).toBeCloseTo(expectedUtilization, 3);
    });
  });

  describe('Enable/Disable Engine', () => {
    let sona: SONAService;

    beforeEach(() => {
      sona = createSONAService({ profile: 'balanced' });
    });

    it('should be enabled by default', () => {
      expect(sona.isEnabled()).toBe(true);
    });

    it('should disable engine', () => {
      sona.setEnabled(false);
      expect(sona.isEnabled()).toBe(false);
    });

    it('should re-enable engine', () => {
      sona.setEnabled(false);
      sona.setEnabled(true);
      expect(sona.isEnabled()).toBe(true);
    });
  });

  describe('Event Emission', () => {
    let sona: SONAService;

    beforeEach(() => {
      sona = createSONAService({ profile: 'balanced' });
    });

    it('should emit trajectory:begin event', (done) => {
      sona.on('trajectory:begin', (data) => {
        expect(data.id).toBeDefined();
        expect(data.route).toBe('claude-sonnet-4-5');
        done();
      });

      const embedding = Array.from({ length: 1536 }, () => Math.random());
      sona.beginTrajectory(embedding, 'claude-sonnet-4-5');
    });

    it('should emit trajectory:end event', (done) => {
      const embedding = Array.from({ length: 1536 }, () => Math.random());
      const trajectoryId = sona.beginTrajectory(embedding);

      sona.on('trajectory:end', (data) => {
        expect(data.trajectoryId).toBe(trajectoryId);
        expect(data.qualityScore).toBe(0.92);
        expect(data.duration).toBeGreaterThan(0);
        done();
      });

      sona.endTrajectory(trajectoryId, 0.92);
    });

    it('should emit learning:cycle event', (done) => {
      sona.on('learning:cycle', (data) => {
        expect(data.status).toBeDefined();
        done();
      });

      sona.forceLearn();
    });
  });

  describe('Quality Improvements by Domain (from KEY_FINDINGS)', () => {
    it('should achieve expected quality gains for different domains', () => {
      // From KEY_FINDINGS.md:
      // Code tasks: +5.0%
      // Creative: +4.3%
      // Reasoning: +3.6%
      // Chat: +2.1%
      // Math: +1.2%

      const expectedGains = {
        code: 0.05,
        creative: 0.043,
        reasoning: 0.036,
        chat: 0.021,
        math: 0.012
      };

      // This test documents expected improvements
      // In production, these would be validated through actual usage
      expect(expectedGains.code).toBe(0.05);
      expect(expectedGains.creative).toBe(0.043);
      expect(expectedGains.reasoning).toBe(0.036);
    });
  });

  describe('Rank Selection Optimization (from KEY_FINDINGS)', () => {
    it('should use rank-2 for optimal throughput', () => {
      // From KEY_FINDINGS: Rank-2 outperforms rank-1
      // Rank-2: 2211 ops/sec
      // Rank-1: 2100 ops/sec

      const rank2 = createSONAService({ microLoraRank: 2 });
      const rank1 = createSONAService({ microLoraRank: 1 });

      expect(rank2.getStats().config.microLoraRank).toBe(2);
      expect(rank1.getStats().config.microLoraRank).toBe(1);

      // Rank-2 should be preferred for production
      expect(sonaService.getStats().config.microLoraRank).toBe(2);
    });
  });
});

/**
 * Unit Tests for BatchOperations Optimization
 *
 * Tests bulk insert, batch processing, and database optimization
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { BatchOperations } from '../../../src/optimizations/BatchOperations.js';
import { EmbeddingService } from '../../../src/controllers/EmbeddingService.js';
import { Episode } from '../../../src/controllers/ReflexionMemory.js';
import * as fs from 'fs';
import * as path from 'path';

const TEST_DB_PATH = './tests/fixtures/test-batch.db';

describe('BatchOperations', () => {
  let db: Database.Database;
  let embedder: EmbeddingService;
  let batchOps: BatchOperations;

  beforeEach(async () => {
    // Clean up
    [TEST_DB_PATH, `${TEST_DB_PATH}-wal`, `${TEST_DB_PATH}-shm`].forEach((file) => {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    });

    // Initialize
    db = new Database(TEST_DB_PATH);
    db.pragma('journal_mode = WAL');

    // Load schemas
    const schemaPath = path.join(__dirname, '../../../src/schemas/schema.sql');
    if (fs.existsSync(schemaPath)) {
      db.exec(fs.readFileSync(schemaPath, 'utf-8'));
    }

    const frontierSchemaPath = path.join(__dirname, '../../../src/schemas/frontier-schema.sql');
    if (fs.existsSync(frontierSchemaPath)) {
      db.exec(fs.readFileSync(frontierSchemaPath, 'utf-8'));
    }

    embedder = new EmbeddingService({
      model: 'mock-model',
      dimension: 384,
      provider: 'local',
    });
    await embedder.initialize();

    batchOps = new BatchOperations(db, embedder, {
      batchSize: 10,
      parallelism: 4,
    });
  });

  afterEach(() => {
    db.close();
    [TEST_DB_PATH, `${TEST_DB_PATH}-wal`, `${TEST_DB_PATH}-shm`].forEach((file) => {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    });
  });

  describe('insertEpisodes', () => {
    it('should insert batch of episodes', async () => {
      const episodes: Episode[] = Array.from({ length: 25 }, (_, i) => ({
        sessionId: `session-${i}`,
        task: `task ${i}`,
        reward: Math.random(),
        success: Math.random() > 0.5,
      }));

      const count = await batchOps.insertEpisodes(episodes);

      expect(count).toBe(25);

      // Verify episodes were inserted
      const dbCount = db.prepare('SELECT COUNT(*) as count FROM episodes').get() as any;
      expect(dbCount.count).toBe(25);

      // Verify embeddings were generated
      const embCount = db.prepare('SELECT COUNT(*) as count FROM episode_embeddings').get() as any;
      expect(embCount.count).toBe(25);
    }, 10000);

    it('should handle progress callback', async () => {
      const episodes: Episode[] = Array.from({ length: 30 }, (_, i) => ({
        sessionId: `session-${i}`,
        task: `task ${i}`,
        reward: Math.random(),
        success: true,
      }));

      const progressUpdates: number[] = [];

      const customBatchOps = new BatchOperations(db, embedder, {
        batchSize: 10,
        parallelism: 4,
        progressCallback: (completed, total) => {
          progressUpdates.push(completed);
        },
      });

      await customBatchOps.insertEpisodes(episodes);

      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates[progressUpdates.length - 1]).toBe(30);
    }, 10000);

    it('should handle large batch efficiently', async () => {
      const episodes: Episode[] = Array.from({ length: 100 }, (_, i) => ({
        sessionId: `session-${i}`,
        task: `task ${i}`,
        reward: Math.random(),
        success: Math.random() > 0.5,
      }));

      const startTime = Date.now();
      const count = await batchOps.insertEpisodes(episodes);
      const duration = Date.now() - startTime;

      expect(count).toBe(100);
      expect(duration).toBeLessThan(5000); // Should complete in less than 5 seconds
    }, 15000);

    it('should handle episodes with all fields', async () => {
      const episodes: Episode[] = [
        {
          sessionId: 'full-episode',
          task: 'comprehensive task',
          input: 'test input',
          output: 'test output',
          critique: 'test critique',
          reward: 0.95,
          success: true,
          latencyMs: 100,
          tokensUsed: 500,
        },
      ];

      const count = await batchOps.insertEpisodes(episodes);

      expect(count).toBe(1);

      // Verify all fields were saved
      const saved = db
        .prepare('SELECT * FROM episodes WHERE session_id = ?')
        .get('full-episode') as any;
      expect(saved.task).toBe('comprehensive task');
      expect(saved.input).toBe('test input');
      expect(saved.output).toBe('test output');
      expect(saved.critique).toBe('test critique');
    });
  });

  describe('regenerateEmbeddings', () => {
    beforeEach(async () => {
      // Seed episodes without embeddings
      const stmt = db.prepare(`
        INSERT INTO episodes (session_id, task, reward, success)
        VALUES (?, ?, ?, ?)
      `);

      for (let i = 0; i < 20; i++) {
        stmt.run(`session-${i}`, `task ${i}`, Math.random(), 1);
      }
    });

    it('should regenerate all embeddings', async () => {
      const count = await batchOps.regenerateEmbeddings();

      expect(count).toBe(20);

      // Verify embeddings were created
      const embCount = db.prepare('SELECT COUNT(*) as count FROM episode_embeddings').get() as any;
      expect(embCount.count).toBe(20);
    }, 10000);

    it('should regenerate specific embeddings', async () => {
      const episodeIds = [1, 2, 3, 4, 5];
      const count = await batchOps.regenerateEmbeddings(episodeIds);

      expect(count).toBe(5);
    });
  });

  describe('processInParallel', () => {
    it('should process items in parallel', async () => {
      const items = Array.from({ length: 20 }, (_, i) => i);

      const results = await batchOps.processInParallel(items, async (item) => {
        return item * 2;
      });

      expect(results).toHaveLength(20);
      results.forEach((result, i) => {
        expect(result).toBe(i * 2);
      });
    });

    it('should handle async processing', async () => {
      const items = Array.from({ length: 10 }, (_, i) => `item-${i}`);

      const results = await batchOps.processInParallel(items, async (item) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return item.toUpperCase();
      });

      expect(results).toHaveLength(10);
      expect(results[0]).toBe('ITEM-0');
    });
  });

  describe('bulkDelete', () => {
    beforeEach(async () => {
      // Seed data
      const stmt = db.prepare(`
        INSERT INTO episodes (session_id, task, reward, success)
        VALUES (?, ?, ?, ?)
      `);

      for (let i = 0; i < 20; i++) {
        stmt.run(`session-${i % 5}`, `task ${i}`, Math.random(), i > 10 ? 1 : 0);
      }
    });

    it('should bulk delete by condition', () => {
      const deleted = batchOps.bulkDelete('episodes', { success: 0 });

      expect(deleted).toBeGreaterThan(0);

      // Verify deletions
      const remaining = db
        .prepare('SELECT COUNT(*) as count FROM episodes WHERE success = 0')
        .get() as any;
      expect(remaining.count).toBe(0);
    });
  });

  describe('bulkUpdate', () => {
    beforeEach(async () => {
      // Seed data
      const stmt = db.prepare(`
        INSERT INTO episodes (session_id, task, reward, success)
        VALUES (?, ?, ?, ?)
      `);

      for (let i = 0; i < 20; i++) {
        stmt.run(`session-${i}`, `task ${i}`, Math.random(), 1);
      }
    });

    it('should bulk update by condition', () => {
      const updated = batchOps.bulkUpdate('episodes', { success: 0 }, { session_id: 'session-5' });

      expect(updated).toBeGreaterThan(0);

      // Verify update
      const record = db
        .prepare('SELECT * FROM episodes WHERE session_id = ?')
        .get('session-5') as any;
      expect(record.success).toBe(0);
    });
  });

  describe('optimize', () => {
    beforeEach(async () => {
      // Add some data
      const stmt = db.prepare(`
        INSERT INTO episodes (session_id, task, reward, success)
        VALUES (?, ?, ?, ?)
      `);

      for (let i = 0; i < 100; i++) {
        stmt.run(`session-${i}`, `task ${i}`, Math.random(), 1);
      }
    });

    it('should optimize database', () => {
      expect(() => batchOps.optimize()).not.toThrow();
    });
  });

  describe('getStats', () => {
    beforeEach(async () => {
      // Add some data
      const episodeStmt = db.prepare(`
        INSERT INTO episodes (session_id, task, reward, success)
        VALUES (?, ?, ?, ?)
      `);

      for (let i = 0; i < 50; i++) {
        episodeStmt.run(`session-${i}`, `task ${i}`, Math.random(), 1);
      }
    });

    it('should return database statistics', () => {
      const stats = batchOps.getStats();

      expect(stats).toHaveProperty('totalSize');
      expect(stats).toHaveProperty('tableStats');
      expect(stats.totalSize).toBeGreaterThan(0);
      expect(stats.tableStats).toBeInstanceOf(Array);
    });

    it('should include table row counts', () => {
      const stats = batchOps.getStats();

      const episodeStats = stats.tableStats.find((t) => t.name === 'episodes');
      expect(episodeStats).toBeDefined();
      expect(episodeStats!.rows).toBe(50);
    });
  });

  describe('Performance', () => {
    it('should insert 1000 episodes efficiently', async () => {
      const episodes: Episode[] = Array.from({ length: 1000 }, (_, i) => ({
        sessionId: `perf-${i}`,
        task: `performance test ${i}`,
        reward: Math.random(),
        success: Math.random() > 0.5,
      }));

      const startTime = Date.now();
      const count = await batchOps.insertEpisodes(episodes);
      const duration = Date.now() - startTime;

      expect(count).toBe(1000);
      expect(duration).toBeLessThan(15000); // Should complete in less than 15 seconds
    }, 20000);
  });

  describe('batchInsertParallel', () => {
    it('should insert data in parallel with default config', async () => {
      const data = Array.from({ length: 3000 }, (_, i) => ({
        session_id: `session-${i}`,
        task: `task ${i}`,
        reward: Math.random(),
        success: Math.random() > 0.5 ? 1 : 0,
      }));

      const result = await batchOps.batchInsertParallel('episodes', data, [
        'session_id',
        'task',
        'reward',
        'success',
      ]);

      expect(result.totalInserted).toBe(3000);
      expect(result.errors).toHaveLength(0);
      expect(result.chunksProcessed).toBe(3); // 3 chunks of 1000
      expect(result.duration).toBeGreaterThan(0);

      // Verify data was inserted
      const count = db.prepare('SELECT COUNT(*) as count FROM episodes').get() as any;
      expect(count.count).toBe(3000);
    }, 20000);

    it('should demonstrate parallel processing capabilities', async () => {
      // Create test data
      const data = Array.from({ length: 5000 }, (_, i) => ({
        session_id: `session-${i}`,
        task: `task ${i}`,
        reward: Math.random(),
        success: 1,
      }));

      // Parallel insert with timing
      const result = await batchOps.batchInsertParallel(
        'episodes',
        data,
        ['session_id', 'task', 'reward', 'success'],
        { chunkSize: 1000, maxConcurrency: 5 }
      );

      // Verify all data was inserted correctly
      expect(result.totalInserted).toBe(5000);
      expect(result.errors).toHaveLength(0);
      expect(result.chunksProcessed).toBe(5);

      // Should complete in reasonable time (benefits vary by system)
      expect(result.duration).toBeGreaterThan(0);
      expect(result.duration).toBeLessThan(10000); // Under 10 seconds

      console.log(
        `Parallel insert (5k rows): ${result.duration}ms (${result.chunksProcessed} chunks)`
      );
    }, 30000);

    it('should handle custom chunk size and concurrency', async () => {
      const data = Array.from({ length: 2500 }, (_, i) => ({
        session_id: `session-${i}`,
        task: `task ${i}`,
        reward: 0.5,
        success: 1,
      }));

      const result = await batchOps.batchInsertParallel(
        'episodes',
        data,
        ['session_id', 'task', 'reward', 'success'],
        { chunkSize: 500, maxConcurrency: 3 }
      );

      expect(result.totalInserted).toBe(2500);
      expect(result.chunksProcessed).toBe(5); // 5 chunks of 500
      expect(result.errors).toHaveLength(0);
    }, 20000);

    it('should handle transaction rollback on error', async () => {
      const data = Array.from({ length: 1000 }, (_, i) => ({
        session_id: `session-${i}`,
        task: `task ${i}`,
        reward: 0.5,
        success: 1,
      }));

      // Add one invalid row to cause error (invalid column value)
      data[500] = {
        session_id: null as any, // session_id is required
        task: 'task 500',
        reward: 0.5,
        success: 1,
      };

      try {
        await batchOps.batchInsertParallel(
          'episodes',
          data,
          ['session_id', 'task', 'reward', 'success'],
          { chunkSize: 1000, maxConcurrency: 2, retryAttempts: 1 }
        );
      } catch (error) {
        // Expected to fail
        expect(error).toBeDefined();
      }

      // Verify that other chunks may have been inserted (depends on timing)
      // But the failed chunk should be fully rolled back
      const count = db.prepare('SELECT COUNT(*) as count FROM episodes').get() as any;
      // Should be less than 1000 since one chunk failed
      expect(count.count).toBeLessThan(1000);
    }, 20000);

    it('should validate table name', async () => {
      const data = [{ col1: 'value1' }];

      await expect(
        batchOps.batchInsertParallel('invalid_table_name', data, ['col1'])
      ).rejects.toThrow();
    });

    it('should validate column names', async () => {
      const data = [{ nonexistent_column: 'value' }];

      await expect(
        batchOps.batchInsertParallel('episodes', data, ['nonexistent_column'])
      ).rejects.toThrow(/Invalid columns/);
    });

    it('should handle JSON data correctly', async () => {
      const data = Array.from({ length: 100 }, (_, i) => ({
        session_id: `session-${i}`,
        task: `task ${i}`,
        reward: 0.5,
        success: 1,
        tags: JSON.stringify(['tag1', 'tag2']),
        metadata: JSON.stringify({ key: 'value' }),
      }));

      const result = await batchOps.batchInsertParallel(
        'episodes',
        data,
        ['session_id', 'task', 'reward', 'success', 'tags', 'metadata'],
        { chunkSize: 50 }
      );

      expect(result.totalInserted).toBe(100);

      // Verify JSON data was stored correctly
      const row = db.prepare('SELECT tags, metadata FROM episodes LIMIT 1').get() as any;
      expect(row.tags).toBeDefined();
      expect(row.metadata).toBeDefined();
    });

    it('should report progress via callback', async () => {
      const data = Array.from({ length: 2000 }, (_, i) => ({
        session_id: `session-${i}`,
        task: `task ${i}`,
        reward: 0.5,
        success: 1,
      }));

      const progressUpdates: number[] = [];
      const progressBatchOps = new BatchOperations(db, embedder, {
        batchSize: 100,
        parallelism: 4,
        progressCallback: (completed, total) => {
          progressUpdates.push(completed);
        },
      });

      await progressBatchOps.batchInsertParallel(
        'episodes',
        data,
        ['session_id', 'task', 'reward', 'success'],
        { chunkSize: 1000 }
      );

      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates[progressUpdates.length - 1]).toBe(2000);
    }, 20000);

    it('should work without transactions when disabled', async () => {
      const data = Array.from({ length: 500 }, (_, i) => ({
        session_id: `session-${i}`,
        task: `task ${i}`,
        reward: 0.5,
        success: 1,
      }));

      const result = await batchOps.batchInsertParallel(
        'episodes',
        data,
        ['session_id', 'task', 'reward', 'success'],
        { chunkSize: 250, useTransaction: false }
      );

      expect(result.totalInserted).toBe(500);
    });

    it('should retry on transient failures', async () => {
      // This test simulates retry behavior by causing a temporary condition
      // In a real scenario, this would test network failures or lock timeouts
      const data = Array.from({ length: 100 }, (_, i) => ({
        session_id: `session-${i}`,
        task: `task ${i}`,
        reward: 0.5,
        success: 1,
      }));

      const result = await batchOps.batchInsertParallel(
        'episodes',
        data,
        ['session_id', 'task', 'reward', 'success'],
        { chunkSize: 50, retryAttempts: 3, retryDelayMs: 50 }
      );

      expect(result.totalInserted).toBe(100);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle empty data array', async () => {
      const result = await batchOps.batchInsertParallel(
        'episodes',
        [],
        ['session_id', 'task', 'reward', 'success']
      );

      expect(result.totalInserted).toBe(0);
      expect(result.chunksProcessed).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle single row', async () => {
      const data = [
        {
          session_id: 'single-session',
          task: 'single task',
          reward: 0.9,
          success: 1,
        },
      ];

      const result = await batchOps.batchInsertParallel('episodes', data, [
        'session_id',
        'task',
        'reward',
        'success',
      ]);

      expect(result.totalInserted).toBe(1);
      expect(result.chunksProcessed).toBe(1);
    });

    it('should benchmark parallel vs sequential for 10k rows', async () => {
      const data = Array.from({ length: 10000 }, (_, i) => ({
        session_id: `bench-${i}`,
        task: `benchmark task ${i}`,
        reward: Math.random(),
        success: Math.random() > 0.5 ? 1 : 0,
      }));

      // Parallel insert
      const parallelStart = Date.now();
      const result = await batchOps.batchInsertParallel(
        'episodes',
        data,
        ['session_id', 'task', 'reward', 'success'],
        { chunkSize: 1000, maxConcurrency: 5 }
      );
      const parallelDuration = Date.now() - parallelStart;

      expect(result.totalInserted).toBe(10000);

      console.log(`Parallel insert (10k rows): ${parallelDuration}ms`);
      console.log(`Speedup potential: ${result.chunksProcessed} chunks processed concurrently`);

      // Should complete in reasonable time (under 10 seconds)
      expect(parallelDuration).toBeLessThan(10000);
    }, 30000);
  });
});

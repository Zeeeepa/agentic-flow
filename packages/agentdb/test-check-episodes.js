import { createDatabase } from './dist/db-fallback.js';

const db = await createDatabase('./test-causal-debug.db');

// Get the schema for episodes
const schema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='episodes'").get();

console.log('episodes schema:');
console.log(schema?.sql || 'Table not found');

// Try to insert an episode
try {
  const result = db.prepare(
    'INSERT INTO episodes (session_id, task, reward, success, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run('test-session', 'test-task', 0.5, 1, Math.floor(Date.now() / 1000));
  console.log('\n✅ Episode insert SUCCESS, ID:', result.lastInsertRowid);
} catch (err) {
  console.log('\n❌ Episode insert FAILED:', err.message);
}

db.close();

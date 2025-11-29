import { createDatabase } from './dist/db-fallback.js';
import { CausalMemoryGraph } from './dist/controllers/CausalMemoryGraph.js';

const db = await createDatabase('./test-causal-debug.db');
const causal = new CausalMemoryGraph(db);

console.log('1. Creating episode...');
const episodeResult = db.prepare(
  'INSERT INTO episodes (session_id, task, reward, success, created_at) VALUES (?, ?, ?, ?, ?)'
).run('test-session', 'experiment', 0.8, 1, Math.floor(Date.now() / 1000));
const episodeId = Number(episodeResult.lastInsertRowid);
console.log('   Episode ID:', episodeId);

console.log('\n2. Recording observation for experiment 1...');
try {
  causal.recordObservation({
    experimentId: 1,
    episodeId: episodeId,
    isTreatment: true,
    outcomeValue: 0.8,
    outcomeType: 'reward',
    context: undefined
  });
  console.log('   ✅ SUCCESS');
} catch (err) {
  console.log('   ❌ FAILED:', err.message);
}

db.close();

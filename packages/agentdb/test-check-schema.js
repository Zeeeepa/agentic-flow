import { createDatabase } from './dist/db-fallback.js';

const db = await createDatabase('./test-schema.db');

// Get the schema for causal_experiments
const schema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='causal_experiments'").get();

console.log('causal_experiments schema:');
console.log(schema?.sql || 'Table not found');

db.close();

#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Analyze TypeScript files for long methods
 */
function analyzeMethodLengths(dirPath) {
  const results = [];

  function scanDirectory(dir) {
    const files = fs.readdirSync(dir);

    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory() && !filePath.includes('node_modules')) {
        scanDirectory(filePath);
      } else if (file.endsWith('.ts') && !file.endsWith('.d.ts') && !file.endsWith('.test.ts')) {
        analyzeFile(filePath);
      }
    }
  }

  function analyzeFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    // Find method/function definitions
    const methodRegex =
      /^\s*(async\s+)?(function\s+\w+|(\w+)\s*\([^)]*\)\s*[:{]|private\s+|public\s+|protected\s+|static\s+)/;
    let currentMethod = null;
    let methodStart = 0;
    let braceCount = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Skip comments and empty lines
      if (line.trim().startsWith('//') || line.trim().startsWith('/*') || line.trim() === '') {
        continue;
      }

      // Check for method start
      if (!currentMethod && methodRegex.test(line)) {
        // Extract method name
        const match = line.match(/(?:function\s+)?(\w+)\s*\(/);
        if (match) {
          currentMethod = match[1];
          methodStart = i;
          braceCount = 0;
        }
      }

      if (currentMethod) {
        // Count braces
        braceCount += (line.match(/{/g) || []).length;
        braceCount -= (line.match(/}/g) || []).length;

        // Method ended
        if (braceCount === 0 && line.includes('}')) {
          const methodLength = i - methodStart + 1;

          if (methodLength > 120) {
            results.push({
              file: filePath.replace(/^.*\/packages\/agentdb\//, ''),
              method: currentMethod,
              startLine: methodStart + 1,
              endLine: i + 1,
              length: methodLength,
            });
          }

          currentMethod = null;
        }
      }
    }
  }

  scanDirectory(dirPath);
  return results;
}

// Run analysis
const agentdbPath = path.join(__dirname, '..', 'packages', 'agentdb', 'src');
const results = analyzeMethodLengths(agentdbPath);

// Sort by length (longest first)
results.sort((a, b) => b.length - a.length);

// Output results
console.log('Methods exceeding 120 lines:\n');
console.log('Rank | File | Method | Lines | Location');
console.log('-----|------|--------|-------|----------');

results.slice(0, 20).forEach((r, idx) => {
  console.log(`${idx + 1}. | ${r.file} | ${r.method} | ${r.length} | L${r.startLine}-${r.endLine}`);
});

console.log(`\nTotal methods >120 lines: ${results.length}`);
console.log('\nTop 5 candidates for refactoring:');
results.slice(0, 5).forEach((r, idx) => {
  console.log(`${idx + 1}. ${r.method} (${r.length} lines) in ${r.file}`);
});

// Export JSON for further processing
fs.writeFileSync(
  path.join(__dirname, '..', 'scripts', 'long-methods.json'),
  JSON.stringify(results, null, 2)
);

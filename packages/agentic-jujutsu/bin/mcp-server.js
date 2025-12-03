#!/usr/bin/env node

/**
 * Agentic-Jujutsu MCP Server CLI
 * Start the MCP server for quantum-resistant version control
 */

const { startJujutsuMCPServer } = require('../src/mcp-server');

console.log('🚀 Starting Agentic-Jujutsu MCP Server...\n');

startJujutsuMCPServer()
  .then(() => {
    console.log('\n✅ MCP Server running on stdio transport');
    console.log('📡 Ready to receive MCP requests\n');
  })
  .catch(error => {
    console.error('❌ Failed to start MCP server:', error.message);
    process.exit(1);
  });

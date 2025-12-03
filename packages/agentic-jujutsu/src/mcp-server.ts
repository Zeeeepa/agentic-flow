/**
 * Agentic-Jujutsu MCP Server
 * Standalone MCP server for quantum-resistant version control operations
 */

import { FastMCP } from 'fastmcp';
import { jjTools, implementationSummary } from './mcp-tools';

/**
 * Create and configure the Agentic-Jujutsu MCP server
 */
export function createJujutsuMCPServer() {
  const server = new FastMCP('agentic-jujutsu', {
    version: '2.3.6',
    description: 'Quantum-resistant version control for AI agents',
  });

  // Register all Jujutsu tools
  jjTools.forEach(tool => {
    server.addTool({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      handler: tool.handler,
    });
  });

  console.log(`✅ Registered ${jjTools.length} Jujutsu MCP tools`);
  console.log(`📋 Tools: ${jjTools.map(t => t.name).join(', ')}`);

  return server;
}

/**
 * Start the MCP server (for standalone usage)
 */
export async function startJujutsuMCPServer() {
  const server = createJujutsuMCPServer();

  // Start server on stdio transport (default for MCP)
  await server.listen();

  console.log('🚀 Agentic-Jujutsu MCP Server started');
  console.log(`📊 Implementation: ${JSON.stringify(implementationSummary, null, 2)}`);

  return server;
}

// Export for integration
export { jjTools, implementationSummary };

// Start server if run directly
if (require.main === module) {
  startJujutsuMCPServer().catch(error => {
    console.error('❌ Failed to start MCP server:', error);
    process.exit(1);
  });
}

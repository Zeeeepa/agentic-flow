#!/usr/bin/env node
/**
 * CLI Init Command
 * Creates .claude/ folder structure and configuration files for Claude Code integration
 * Copies all agents, commands, skills, and helpers from the package
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CLAUDE_MD_TEMPLATE = `# Claude Code Configuration - Agentic Flow

## Project Setup

This project is configured with Agentic Flow for AI agent orchestration.

## Available Commands

### Quick Start
\`\`\`bash
# Start MCP server for Claude Code integration
npx agentic-flow@alpha mcp start

# Run an agent directly
npx agentic-flow@alpha --agent coder --task "Your task here"

# List available agents
npx agentic-flow@alpha --list
\`\`\`

### Hooks (Self-learning Intelligence)
\`\`\`bash
npx agentic-flow@alpha hooks pre-edit <file>    # Get context before editing
npx agentic-flow@alpha hooks post-edit <file>   # Learn from edits
npx agentic-flow@alpha hooks route <task>       # Smart agent routing
\`\`\`

### Workers (Background Tasks)
\`\`\`bash
npx agentic-flow@alpha workers status           # Check worker status
npx agentic-flow@alpha workers dispatch <task>  # Dispatch background task
\`\`\`

## Code Style

- Use TypeScript for new code
- Follow existing patterns in the codebase
- Add tests for new functionality

## Important Notes

- Never hardcode secrets - use environment variables
- Keep files under 500 lines when possible
- Write tests before implementation (TDD)
`;

const SETTINGS_TEMPLATE = {
  model: "claude-sonnet-4-20250514",
  customInstructions: "Follow the project's CLAUDE.md guidelines",
  permissions: {
    allowedTools: ["Read", "Write", "Edit", "Bash", "Glob", "Grep", "Task", "WebFetch", "WebSearch"],
    deniedTools: []
  },
  hooks: {
    PreToolUse: [
      {
        matcher: "Edit|Write|MultiEdit",
        hooks: ["npx agentic-flow@alpha hooks pre-edit"]
      }
    ],
    PostToolUse: [
      {
        matcher: "Edit|Write|MultiEdit",
        hooks: ["npx agentic-flow@alpha hooks post-edit"]
      }
    ],
    Notification: [
      {
        matcher: ".*",
        hooks: ["npx agentic-flow@alpha hooks notify"]
      }
    ]
  },
  agents: {
    source: ".claude/agents",
    customAgents: []
  },
  skills: {
    source: ".claude/commands",
    enabled: true
  },
  statusline: {
    enabled: true,
    components: ["model", "tokens", "cost", "time"]
  },
  mcpServers: {
    "claude-flow": {
      command: "npx",
      args: ["agentic-flow@alpha", "mcp", "start"]
    }
  }
};

interface InitOptions {
  force?: boolean;
  minimal?: boolean;
  verbose?: boolean;
}

/**
 * Recursively copy a directory
 */
function copyDirRecursive(src: string, dest: string, verbose: boolean = false): number {
  let fileCount = 0;

  if (!fs.existsSync(src)) {
    return fileCount;
  }

  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      fileCount += copyDirRecursive(srcPath, destPath, verbose);
    } else {
      fs.copyFileSync(srcPath, destPath);
      fileCount++;
      if (verbose) {
        console.log(`   📄 ${path.relative(dest, destPath)}`);
      }
    }
  }

  return fileCount;
}

/**
 * Find the package's .claude directory
 */
function findPackageClaudeDir(): string | null {
  // Try multiple potential locations
  const potentialPaths = [
    // When running from dist/
    path.resolve(__dirname, '..', '..', '..', '.claude'),
    // When running from src/
    path.resolve(__dirname, '..', '..', '.claude'),
    // When installed as package
    path.resolve(__dirname, '..', '.claude'),
    // Fallback to package root
    path.resolve(process.cwd(), 'node_modules', 'agentic-flow', '.claude'),
  ];

  for (const p of potentialPaths) {
    if (fs.existsSync(p) && fs.statSync(p).isDirectory()) {
      return p;
    }
  }

  return null;
}

export async function handleInitCommand(args: string[]): Promise<void> {
  const options: InitOptions = {
    force: args.includes('--force') || args.includes('-f'),
    minimal: args.includes('--minimal') || args.includes('-m'),
    verbose: args.includes('--verbose') || args.includes('-v')
  };

  if (args.includes('--help') || args.includes('-h')) {
    printInitHelp();
    return;
  }

  const cwd = process.cwd();
  const claudeDir = path.join(cwd, '.claude');
  const claudeMdFile = path.join(cwd, 'CLAUDE.md');

  console.log(`
╔═══════════════════════════════════════════════════════╗
║       Agentic Flow - Project Initialization           ║
╚═══════════════════════════════════════════════════════╝
`);

  // Check if already initialized
  if (fs.existsSync(claudeDir) && !options.force) {
    console.log('⚠️  .claude/ directory already exists.');
    console.log('   Use --force to overwrite existing configuration.\n');
    return;
  }

  try {
    // Find the package's .claude directory
    const packageClaudeDir = findPackageClaudeDir();

    if (packageClaudeDir && !options.minimal) {
      console.log('📦 Copying full .claude/ structure from agentic-flow package...\n');

      // Copy entire .claude directory structure
      const directories = ['agents', 'commands', 'skills', 'helpers'];
      let totalFiles = 0;

      for (const dir of directories) {
        const srcDir = path.join(packageClaudeDir, dir);
        const destDir = path.join(claudeDir, dir);

        if (fs.existsSync(srcDir)) {
          const count = copyDirRecursive(srcDir, destDir, options.verbose);
          totalFiles += count;
          console.log(`✅ Copied .claude/${dir}/ (${count} files)`);
        }
      }

      // Copy individual files (settings.json is generated fresh with our template)
      const individualFiles = ['mcp.json'];
      for (const file of individualFiles) {
        const srcFile = path.join(packageClaudeDir, file);
        const destFile = path.join(claudeDir, file);
        if (fs.existsSync(srcFile)) {
          fs.copyFileSync(srcFile, destFile);
          console.log(`✅ Copied .claude/${file}`);
          totalFiles++;
        }
      }

      console.log(`\n📊 Total: ${totalFiles} files copied`);
    } else {
      // Minimal mode: create basic structure
      console.log('📦 Creating minimal .claude/ structure...\n');

      if (!fs.existsSync(claudeDir)) {
        fs.mkdirSync(claudeDir, { recursive: true });
      }

      const dirs = ['agents', 'commands', 'skills', 'helpers'];
      for (const dir of dirs) {
        const dirPath = path.join(claudeDir, dir);
        if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(dirPath, { recursive: true });
          console.log(`✅ Created .claude/${dir}/`);
        }
      }
    }

    // Always generate fresh settings.json with our template
    const settingsFile = path.join(claudeDir, 'settings.json');
    if (!fs.existsSync(settingsFile) || options.force) {
      fs.writeFileSync(settingsFile, JSON.stringify(SETTINGS_TEMPLATE, null, 2));
      console.log('✅ Created .claude/settings.json (with hooks, agents, skills, statusline)');
    }

    // Create CLAUDE.md in project root (unless minimal mode)
    if (!options.minimal) {
      if (!fs.existsSync(claudeMdFile) || options.force) {
        fs.writeFileSync(claudeMdFile, CLAUDE_MD_TEMPLATE);
        console.log('✅ Created CLAUDE.md');
      } else {
        console.log('ℹ️  CLAUDE.md already exists (skipped)');
      }
    }

    console.log(`
╔═══════════════════════════════════════════════════════╗
║                 Initialization Complete!               ║
╚═══════════════════════════════════════════════════════╝

📁 Created structure:
   .claude/
   ├── settings.json      # Claude Code settings (hooks, agents, skills, statusline)
   ├── agents/            # 80+ agent definitions (coder, tester, reviewer, etc.)
   ├── commands/          # 100+ slash commands (swarm, github, sparc, etc.)
   ├── skills/            # Custom skills and workflows
   └── helpers/           # Helper utilities
   CLAUDE.md              # Project instructions

🚀 Next steps:
   1. Start the MCP server:
      npx agentic-flow@alpha mcp start

   2. Run Claude Code:
      claude

   3. Or run agents directly:
      npx agentic-flow@alpha --agent coder --task "Your task"

📖 Documentation:
   https://github.com/ruvnet/agentic-flow
`);

  } catch (error) {
    console.error('❌ Initialization failed:', error);
    process.exit(1);
  }
}

function printInitHelp(): void {
  console.log(`
Agentic Flow - Project Initialization

USAGE:
  npx agentic-flow@alpha init [OPTIONS]

OPTIONS:
  --force, -f     Overwrite existing configuration
  --minimal, -m   Create minimal setup (empty directories only)
  --verbose, -v   Show detailed file copy output
  --help, -h      Show this help

EXAMPLES:
  npx agentic-flow@alpha init               # Initialize with full agent/command library
  npx agentic-flow@alpha init --force       # Reinitialize (overwrite existing)
  npx agentic-flow@alpha init --minimal     # Minimal setup (empty directories)
  npx agentic-flow@alpha init --verbose     # Show all files being copied

CREATED FILES:
  .claude/                  Claude Code configuration directory
  .claude/settings.json     Settings with hooks, agents, skills, statusline, MCP servers
  .claude/agents/           80+ agent definitions (coder, tester, reviewer, sparc, etc.)
  .claude/commands/         100+ slash commands (swarm, github, sparc, etc.)
  .claude/skills/           Custom skills and workflows
  .claude/helpers/          Helper utilities
  CLAUDE.md                 Project instructions for Claude
`);
}

// Run if executed directly
if (process.argv[1]?.endsWith('init.js') || process.argv[1]?.endsWith('init.ts')) {
  const args = process.argv.slice(2);
  handleInitCommand(args);
}

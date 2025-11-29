# AgentDB Documentation

**Version:** 1.6.1 → 2.0.0 (v2 with backward compatibility)
**Last Updated:** 2025-11-29

This directory contains comprehensive documentation for AgentDB, organized into logical categories for easy navigation.

## 📖 Navigation

**[→ Full Documentation Index](./INDEX.md)** - Complete table of contents with all documents

## Directory Structure

### 📚 **guides/**
User guides, migration documentation, and tutorials
- [SDK Guide](guides/SDK_GUIDE.md) - Complete SDK usage and API reference
- [Migration Guide](guides/MIGRATION_GUIDE.md) - General migration instructions
- [Migration V2](guides/MIGRATION_V2.md) - v2 migration specifics
- [Browser V2 Migration](guides/BROWSER_V2_MIGRATION.md) - Browser environment migration
- [Frontier Memory Guide](guides/FRONTIER_MEMORY_GUIDE.md) - Advanced memory patterns
- [Troubleshooting](guides/TROUBLESHOOTING.md) - Common issues and solutions
- Browser advanced features and usage examples

### 🔧 **implementation/**
Implementation reports and technical summaries
- [HNSW Implementation](implementation/HNSW-IMPLEMENTATION-COMPLETE.md) - Vector search
- [RuVector Backend](implementation/RUVECTOR_BACKEND_IMPLEMENTATION.md) - @ruvector/core integration
- [WASM Vector Acceleration](implementation/WASM-VECTOR-ACCELERATION.md) - Performance optimization
- [MCP Integration](implementation/MCP_INTEGRATION.md) - Model Context Protocol
- [Core Tools Implementation](implementation/CORE_TOOLS_IMPLEMENTATION.md) - Tool 1-10
- [Agentic Flow Integration](implementation/AGENTIC_FLOW_INTEGRATION_REPORT.md)

### 🚀 **quic/**
QUIC protocol research and implementation
- [QUIC Index](quic/QUIC-INDEX.md) - Overview and navigation
- [Architecture](quic/QUIC-ARCHITECTURE.md) - System design
- [Architecture Diagrams](quic/QUIC-ARCHITECTURE-DIAGRAMS.md) - Visual references
- [Implementation Roadmap](quic/QUIC-IMPLEMENTATION-ROADMAP.md) - Development plan
- [Sync Implementation](quic/QUIC-SYNC-IMPLEMENTATION.md) - Cross-database sync
- [Quality Analysis](quic/QUIC-QUALITY-ANALYSIS.md) - Performance metrics

### 📦 **releases/**
Release notes and version documentation
- [V2 Alpha Release](releases/V2_ALPHA_RELEASE.md) - Latest v2 documentation
- [V1.6.0 Final Release](releases/V1.6.0-FINAL-RELEASE-SUMMARY.md) - Current stable
- [V1.7.0 Regression Report](releases/V1.7.0-REGRESSION-REPORT.md) - Known issues
- Version-specific migration guides and validation reports
- Updated features and implementation summaries

**Archived:** Historical releases (v1.2.2-v1.3.x) moved to `archive/old-releases/`

### 📊 **reports/**
Performance, optimization, and implementation reports
- [Optimization Report](reports/OPTIMIZATION-REPORT.md) - Performance improvements
- [Validation Report](reports/VALIDATION-REPORT.md) - Quality assurance
- [Batch Optimization Results](reports/BATCH-OPTIMIZATION-RESULTS.md) - Bulk operations
- [MCP Optimization Summary](reports/MCP-OPTIMIZATION-SUMMARY.md) - Tool efficiency
- Browser implementation and minification reports

### 🔬 **research/**
Research papers and comprehensive analyses
- [GNN Attention Vector Search](research/gnn-attention-vector-search-comprehensive-analysis.md) - Comprehensive analysis of graph neural networks for vector search

### ✅ **validation/**
Testing, validation, and audit reports
- [Validation Summary](validation/VALIDATION-SUMMARY.md) - Overall status
- [CLI Validation Results](validation/CLI-VALIDATION-RESULTS.md) - Command-line testing
- [Browser V2 Test Results](validation/BROWSER_V2_TEST_RESULTS.md) - Browser compatibility
- [Comprehensive Regression Analysis](validation/agentdb-comprehensive-regression-analysis.md)
- NPX validation, hooks validation, and deployment reports

### 🏗️ **architecture/**
System architecture and design specifications
- [Backends](architecture/BACKENDS.md) - Vector backend architecture (SQLite, RuVector, WASM)
- [GNN Learning](architecture/GNN_LEARNING.md) - Graph neural network specifications
- [MCP Tools](architecture/MCP_TOOLS.md) - Model Context Protocol architecture
- [Tool Design Specification](architecture/TOOL_DESIGN_SPEC.md) - Implementation specs
- [Specification Tools Design](architecture/SPECIFICATION_TOOLS_DESIGN.md)

### 📜 **legacy/**
Historical documentation and deprecated content
- Old code reviews and security fixes
- Documentation audits and landing pages
- Browser/WASM fixes and CLI initialization
- Publishing summaries

### 📍 **current-status/**
Current production status and optimization reports
- [Production Readiness Report](current-status/FINAL_PRODUCTION_READINESS_REPORT_2025-11-29.md) - Latest production status
- [Phase 2 MCP Optimization](current-status/PHASE-2-MCP-OPTIMIZATION-REVIEW.md) - MCP optimization review
- [MCP Tool Optimization Guide](current-status/MCP_TOOL_OPTIMIZATION_GUIDE.md) - Performance tuning

### 🗄️ **archive/**
Archived session reports and historical documents
- **sessions/** - Development session summaries (2025-11-28)
- **reviews/** - Code reviews and audits
- **old-releases/** - Historical release documentation (v1.2.2-v1.3.x)

## 🚀 Quick Start

### New Users
1. Read the [SDK Guide](guides/SDK_GUIDE.md)
2. Check [Current Release Notes](releases/V2_ALPHA_RELEASE.md)
3. Review [Architecture Overview](architecture/BACKENDS.md)

### Migrating from v1
1. Review [Migration V2 Guide](guides/MIGRATION_V2.md)
2. Check [Browser V2 Migration](guides/BROWSER_V2_MIGRATION.md) if using browser
3. Read [v1.6.0 Migration](releases/V1.6.0_MIGRATION.md) for breaking changes

### Developers
1. Review [Implementation Reports](implementation/)
2. Check [Architecture Documentation](architecture/)
3. See [Tool Design Specs](architecture/TOOL_DESIGN_SPEC.md)

## 📑 Key Documents

### Current Status
- [Production Readiness Report](current-status/FINAL_PRODUCTION_READINESS_REPORT_2025-11-29.md) - Latest status
- [Phase 2 MCP Optimization Review](current-status/PHASE-2-MCP-OPTIMIZATION-REVIEW.md) - Optimization status
- [MCP Tool Optimization Guide](current-status/MCP_TOOL_OPTIMIZATION_GUIDE.md) - Performance tuning

### Validation & Testing
- [Validation Summary README](validation/VALIDATION-SUMMARY-README.md) - Test coverage overview
- [CLI Deep Validation Report](validation/CLI-DEEP-VALIDATION-REPORT.md) - CLI testing results
- [Validation Summary](validation/VALIDATION-SUMMARY.md) - Overall validation status

### Performance
- [WASM Vector README](implementation/WASM-VECTOR-README.md) - WASM acceleration
- [Performance Report](reports/PERFORMANCE-REPORT.md) - Benchmarks
- [Batch Optimization](reports/BATCH-OPTIMIZATION-RESULTS.md) - Bulk operations

## 🔧 Related Documentation

- [Scripts README](../scripts/README.md) - Build and deployment scripts
- [Main Package README](../README.md) - AgentDB overview
- [Full Index](INDEX.md) - Complete documentation index

## 📐 Documentation Standards

### File Naming
- Use `SCREAMING_SNAKE_CASE` for reports and documentation
- Use `kebab-case` for guides and tutorials
- Include version numbers where applicable

### Organization
- Each major feature requires comprehensive documentation
- Migration guides required for breaking changes
- All new features need validation reports
- Performance benchmarks for optimization work

### Format
- GitHub-flavored Markdown
- Code examples with syntax highlighting
- Clear section headers and navigation
- Links to related documentation

## 🛠️ Scripts Integration

All build and validation scripts are documented in:
- [Scripts README](../scripts/README.md) - Complete script reference
- Key scripts: browser builds, validation, security checks, releases

## 📞 Support

- **Issues:** https://github.com/ruvnet/agentic-flow/issues
- **Homepage:** https://agentdb.ruv.io
- **Repository:** https://github.com/ruvnet/agentic-flow

---

**AgentDB v1.6.1** | MIT License | Built with @ruvector/core v0.1.15

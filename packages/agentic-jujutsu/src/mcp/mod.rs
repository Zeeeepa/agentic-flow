//! Model Context Protocol (MCP) integration for agentic-jujutsu
//!
//! This module provides MCP client and server implementations for seamless
//! integration with AgentDB and other agentic-flow services.
//!
//! Supports:
//! - stdio transport (for local processes)
//! - SSE transport (for remote/web clients)

pub mod client;
pub mod server;
pub mod stdio;
pub mod sse;
pub mod types;

pub use client::{MCPClient, MCPClientConfig};
pub use server::{MCPServer, MCPServerConfig};
pub use stdio::{StdioTransport, StdioServer};
pub use sse::{SSETransport, SSEServer};
pub use types::{MCPRequest, MCPResponse, MCPMethod, MCPError};


/// MCP transport types
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TransportType {
    /// Standard input/output transport (for CLI tools)
    Stdio,
    /// Server-Sent Events transport (for web/remote clients)
    SSE,
}

impl TransportType {
    /// Check if this is a stdio transport
    pub fn is_stdio(&self) -> bool {
        matches!(self, TransportType::Stdio)
    }

    /// Check if this is an SSE transport
    pub fn is_sse(&self) -> bool {
        matches!(self, TransportType::SSE)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_transport_type_checks() {
        assert!(TransportType::Stdio.is_stdio());
        assert!(!TransportType::Stdio.is_sse());
        assert!(TransportType::SSE.is_sse());
        assert!(!TransportType::SSE.is_stdio());
    }
}

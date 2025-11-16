//! MCP client implementation

use super::types::{MCPRequest, MCPResponse};
use super::{TransportType, StdioTransport, SSETransport};
use crate::{Result, JJError};
use serde_json::Value;
use std::sync::atomic::{AtomicU64, Ordering};

/// MCP client configuration
#[derive(Debug, Clone)]
pub struct MCPClientConfig {
    /// Transport type (stdio or SSE)
    pub transport: TransportType,
    /// Server endpoint (for SSE transport)
    pub endpoint: Option<String>,
    /// Request timeout in milliseconds
    pub timeout_ms: u64,
    /// Enable verbose logging
    pub verbose: bool,
}

impl Default for MCPClientConfig {
    fn default() -> Self {
        Self {
            transport: TransportType::Stdio,
            endpoint: None,
            timeout_ms: 30000, // 30 seconds
            verbose: false,
        }
    }
}

impl MCPClientConfig {
    /// Create config for stdio transport
    pub fn stdio() -> Self {
        Self {
            transport: TransportType::Stdio,
            ..Default::default()
        }
    }

    /// Create config for SSE transport
    pub fn sse(endpoint: String) -> Self {
        Self {
            transport: TransportType::SSE,
            endpoint: Some(endpoint),
            ..Default::default()
        }
    }

    /// Set timeout
    pub fn with_timeout(mut self, timeout_ms: u64) -> Self {
        self.timeout_ms = timeout_ms;
        self
    }

    /// Enable verbose logging
    pub fn with_verbose(mut self, verbose: bool) -> Self {
        self.verbose = verbose;
        self
    }
}

/// MCP client for communicating with MCP servers
pub struct MCPClient {
    config: MCPClientConfig,
    stdio_transport: Option<StdioTransport>,
    sse_transport: Option<SSETransport>,
    request_counter: AtomicU64,
}

impl MCPClient {
    /// Create a new MCP client
    pub async fn new(config: MCPClientConfig) -> Result<Self> {
        let (stdio_transport, sse_transport) = match config.transport {
            TransportType::Stdio => (Some(StdioTransport::new()), None),
            TransportType::SSE => {
                let endpoint = config.endpoint.clone().ok_or_else(|| {
                    JJError::MCPError("SSE endpoint is required for SSE transport".to_string())
                })?;
                (None, Some(SSETransport::new(endpoint)))
            }
        };

        Ok(Self {
            config,
            stdio_transport,
            sse_transport,
            request_counter: AtomicU64::new(1),
        })
    }

    /// Generate next request ID
    fn next_request_id(&self) -> String {
        let id = self.request_counter.fetch_add(1, Ordering::SeqCst);
        format!("req-{}", id)
    }

    /// Send a request and wait for response
    pub async fn request(&self, method: String, params: Option<Value>) -> Result<MCPResponse> {
        let request_id = self.next_request_id();
        let request = MCPRequest::new(request_id.clone(), method, params);

        if self.config.verbose {
            eprintln!("[mcp-client] Sending request: {:?}", request);
        }

        let response = match self.config.transport {
            TransportType::Stdio => {
                let transport = self.stdio_transport.as_ref().ok_or_else(|| {
                    JJError::MCPError("Stdio transport not initialized".to_string())
                })?;
                transport.send_request(&request).await?
            }
            TransportType::SSE => {
                let transport = self.sse_transport.as_ref().ok_or_else(|| {
                    JJError::MCPError("SSE transport not initialized".to_string())
                })?;
                transport.send_request(&request).await?
            }
        };

        if self.config.verbose {
            eprintln!("[mcp-client] Received response: {:?}", response);
        }

        Ok(response)
    }

    /// Store a pattern in AgentDB
    pub async fn store_pattern(&self, episode: Value) -> Result<Value> {
        let response = self
            .request(
                "agentdb_pattern_store".to_string(),
                Some(episode),
            )
            .await?;

        if let Some(error) = response.error {
            return Err(JJError::MCPError(format!(
                "AgentDB pattern store failed: {}",
                error.message
            )));
        }

        response.result.ok_or_else(|| {
            JJError::MCPError("AgentDB pattern store returned no result".to_string())
        })
    }

    /// Search for similar patterns
    pub async fn search_patterns(&self, task: String, k: usize) -> Result<Value> {
        let response = self
            .request(
                "agentdb_pattern_search".to_string(),
                Some(serde_json::json!({
                    "task": task,
                    "k": k
                })),
            )
            .await?;

        if let Some(error) = response.error {
            return Err(JJError::MCPError(format!(
                "AgentDB pattern search failed: {}",
                error.message
            )));
        }

        response.result.ok_or_else(|| {
            JJError::MCPError("AgentDB pattern search returned no result".to_string())
        })
    }

    /// Get pattern statistics
    pub async fn get_pattern_stats(&self, task: String, k: usize) -> Result<Value> {
        let response = self
            .request(
                "agentdb_pattern_stats".to_string(),
                Some(serde_json::json!({
                    "task": task,
                    "k": k
                })),
            )
            .await?;

        if let Some(error) = response.error {
            return Err(JJError::MCPError(format!(
                "AgentDB pattern stats failed: {}",
                error.message
            )));
        }

        response.result.ok_or_else(|| {
            JJError::MCPError("AgentDB pattern stats returned no result".to_string())
        })
    }

    /// Get AgentDB statistics
    pub async fn get_agentdb_stats(&self) -> Result<Value> {
        let response = self
            .request("agentdb_stats".to_string(), None)
            .await?;

        if let Some(error) = response.error {
            return Err(JJError::MCPError(format!(
                "AgentDB stats failed: {}",
                error.message
            )));
        }

        response.result.ok_or_else(|| {
            JJError::MCPError("AgentDB stats returned no result".to_string())
        })
    }

    /// Clear AgentDB cache
    pub async fn clear_cache(&self) -> Result<Value> {
        let response = self
            .request("agentdb_clear_cache".to_string(), Some(serde_json::json!({"confirm": true})))
            .await?;

        if let Some(error) = response.error {
            return Err(JJError::MCPError(format!(
                "AgentDB clear cache failed: {}",
                error.message
            )));
        }

        response.result.ok_or_else(|| {
            JJError::MCPError("AgentDB clear cache returned no result".to_string())
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_config_creation() {
        let config = MCPClientConfig::stdio();
        assert!(config.transport.is_stdio());
        assert_eq!(config.timeout_ms, 30000);

        let config = MCPClientConfig::sse("http://localhost:3000".to_string());
        assert!(config.transport.is_sse());
        assert_eq!(config.endpoint, Some("http://localhost:3000".to_string()));
    }

    #[test]
    fn test_config_builder() {
        let config = MCPClientConfig::stdio()
            .with_timeout(60000)
            .with_verbose(true);

        assert_eq!(config.timeout_ms, 60000);
        assert!(config.verbose);
    }

    #[tokio::test]
    async fn test_client_creation_stdio() {
        let config = MCPClientConfig::stdio();
        let client = MCPClient::new(config).await;
        assert!(client.is_ok());
    }

    #[tokio::test]
    async fn test_client_creation_sse() {
        let config = MCPClientConfig::sse("http://localhost:3000".to_string());
        let client = MCPClient::new(config).await;
        assert!(client.is_ok());
    }

    #[tokio::test]
    async fn test_request_id_generation() {
        let config = MCPClientConfig::stdio();
        let client = MCPClient::new(config).await.unwrap();

        let id1 = client.next_request_id();
        let id2 = client.next_request_id();

        assert_ne!(id1, id2);
        assert!(id1.starts_with("req-"));
        assert!(id2.starts_with("req-"));
    }
}

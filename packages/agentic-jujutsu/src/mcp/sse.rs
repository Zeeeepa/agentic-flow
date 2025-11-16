//! Server-Sent Events (SSE) transport for MCP (HTTP-based communication)

use super::types::{MCPRequest, MCPResponse};
use crate::{Result, JJError};
use std::sync::Arc;
use std::collections::HashMap;
use tokio::sync::{mpsc, RwLock};

/// SSE transport for communicating with MCP servers via HTTP/SSE
pub struct SSETransport {
    endpoint: String,
    client: Arc<HttpClient>,
}

/// Simple HTTP client (can be replaced with reqwest or other HTTP client)
struct HttpClient {
    base_url: String,
}

impl HttpClient {
    fn new(base_url: String) -> Self {
        Self { base_url }
    }

    /// Send POST request (simplified - would use reqwest in production)
    async fn post(&self, path: &str, body: serde_json::Value) -> Result<serde_json::Value> {
        // In a real implementation, this would use reqwest:
        // let response = reqwest::Client::new()
        //     .post(format!("{}{}", self.base_url, path))
        //     .json(&body)
        //     .send()
        //     .await?
        //     .json()
        //     .await?;

        // For now, return a stub implementation
        #[cfg(not(target_arch = "wasm32"))]
        {
            eprintln!("[sse-transport] Would POST to {}{}", self.base_url, path);
            eprintln!("[sse-transport] Body: {}", serde_json::to_string_pretty(&body).unwrap());
        }

        #[cfg(target_arch = "wasm32")]
        {
            web_sys::console::log_1(&format!("[sse-transport] Would POST to {}{}", self.base_url, path).into());
        }

        // TODO: Implement actual HTTP request
        // This is a stub that returns success
        Ok(serde_json::json!({
            "success": true,
            "message": "SSE transport stub - implement with reqwest"
        }))
    }
}

impl SSETransport {
    /// Create a new SSE transport
    pub fn new(endpoint: String) -> Self {
        Self {
            endpoint: endpoint.clone(),
            client: Arc::new(HttpClient::new(endpoint)),
        }
    }

    /// Send a request and wait for response
    pub async fn send_request(&self, request: &MCPRequest) -> Result<MCPResponse> {
        // Serialize request
        let request_json = serde_json::to_value(request)
            .map_err(|e| JJError::SerializationError(format!("Failed to serialize request: {}", e)))?;

        // Send request via HTTP POST
        let response_json = self.client.post("/mcp/request", request_json).await?;

        // Parse response (stub - returns success)
        let response = MCPResponse::success(
            request.id.clone(),
            response_json,
        );

        Ok(response)
    }

    /// Subscribe to SSE events
    pub async fn subscribe(&self) -> Result<SSESubscription> {
        // In a real implementation, this would:
        // 1. Open an SSE connection to the server
        // 2. Return a stream of events
        // For now, return a stub subscription

        Ok(SSESubscription {
            endpoint: self.endpoint.clone(),
            receiver: None,
        })
    }
}

/// SSE subscription for receiving server events
pub struct SSESubscription {
    endpoint: String,
    receiver: Option<mpsc::Receiver<MCPResponse>>,
}

impl SSESubscription {
    /// Receive next event
    pub async fn next(&mut self) -> Option<MCPResponse> {
        // In a real implementation, this would receive from the SSE stream
        // For now, return None (no events)
        if let Some(receiver) = &mut self.receiver {
            receiver.recv().await
        } else {
            None
        }
    }
}

/// SSE-based MCP server
pub struct SSEServer {
    config: SSEServerConfig,
    handlers: Arc<RwLock<HashMap<String, HandlerFn>>>,
    clients: Arc<RwLock<HashMap<String, ClientConnection>>>,
}

/// SSE server configuration
#[derive(Debug, Clone)]
pub struct SSEServerConfig {
    pub host: String,
    pub port: u16,
    pub path: String,
}

impl Default for SSEServerConfig {
    fn default() -> Self {
        Self {
            host: "127.0.0.1".to_string(),
            port: 3000,
            path: "/mcp".to_string(),
        }
    }
}

type HandlerFn = Arc<dyn Fn(MCPRequest) -> Result<MCPResponse> + Send + Sync>;

struct ClientConnection {
    id: String,
    sender: mpsc::Sender<MCPResponse>,
}

impl SSEServer {
    /// Create a new SSE server
    pub fn new(config: SSEServerConfig) -> Self {
        Self {
            config,
            handlers: Arc::new(RwLock::new(HashMap::new())),
            clients: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Register a handler for a specific method
    pub async fn register_handler<F>(&self, method: String, handler: F) -> Result<()>
    where
        F: Fn(MCPRequest) -> Result<MCPResponse> + Send + Sync + 'static,
    {
        let mut handlers = self.handlers.write().await;
        handlers.insert(method, Arc::new(handler));
        Ok(())
    }

    /// Start the SSE server
    pub async fn start(&self) -> Result<()> {
        let addr = format!("{}:{}", self.config.host, self.config.port);

        #[cfg(not(target_arch = "wasm32"))]
        {
            eprintln!("[sse-server] Would start SSE server at http://{}{}", addr, self.config.path);
            eprintln!("[sse-server] Registered handlers: {:?}",
                self.handlers.read().await.keys().collect::<Vec<_>>());
        }

        // In a real implementation, this would:
        // 1. Start an HTTP server (using axum, warp, or actix-web)
        // 2. Handle SSE connections on self.config.path
        // 3. Route requests to registered handlers
        // 4. Stream responses back to clients

        // TODO: Implement actual HTTP/SSE server
        // Example with axum:
        // let app = Router::new()
        //     .route(&self.config.path, post(handle_request))
        //     .route(&format!("{}/events", self.config.path), get(handle_sse));
        // axum::Server::bind(&addr.parse()?)
        //     .serve(app.into_make_service())
        //     .await?;

        Ok(())
    }

    /// Send event to all connected clients
    pub async fn broadcast(&self, response: MCPResponse) -> Result<()> {
        let clients = self.clients.read().await;

        for (client_id, client) in clients.iter() {
            if let Err(e) = client.sender.send(response.clone()).await {
                #[cfg(not(target_arch = "wasm32"))]
                eprintln!("[sse-server] Failed to send to client {}: {}", client_id, e);
            }
        }

        Ok(())
    }

    /// Send event to specific client
    pub async fn send_to_client(&self, client_id: &str, response: MCPResponse) -> Result<()> {
        let clients = self.clients.read().await;

        if let Some(client) = clients.get(client_id) {
            client.sender.send(response).await
                .map_err(|e| JJError::MCPError(format!("Failed to send to client: {}", e)))?;
        }

        Ok(())
    }
}

impl Default for SSEServer {
    fn default() -> Self {
        Self::new(SSEServerConfig::default())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sse_transport_creation() {
        let transport = SSETransport::new("http://localhost:3000".to_string());
        assert_eq!(transport.endpoint, "http://localhost:3000");
    }

    #[test]
    fn test_sse_server_config() {
        let config = SSEServerConfig::default();
        assert_eq!(config.host, "127.0.0.1");
        assert_eq!(config.port, 3000);
        assert_eq!(config.path, "/mcp");
    }

    #[test]
    fn test_sse_server_creation() {
        let server = SSEServer::new(SSEServerConfig::default());
        assert_eq!(server.config.port, 3000);
    }

    #[tokio::test]
    async fn test_register_handler() {
        let server = SSEServer::new(SSEServerConfig::default());

        let handler = |req: MCPRequest| -> Result<MCPResponse> {
            Ok(MCPResponse::success(req.id, serde_json::json!({"ok": true})))
        };

        server.register_handler("test_method".to_string(), handler).await.unwrap();

        let handlers = server.handlers.read().await;
        assert!(handlers.contains_key("test_method"));
    }
}

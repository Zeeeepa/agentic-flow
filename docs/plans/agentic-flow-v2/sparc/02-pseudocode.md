# SPARC Phase 2: Pseudocode

## 🎯 Algorithm Design and Data Flow

This document outlines the core algorithms and data flows for Agentic-Flow v2.0, focusing on the intelligent orchestration of agents with AgentDB integration, smart LLM routing, meta-learning, and distributed consensus.

## 📋 Core Algorithms

### Algorithm 1: Smart Swarm Initialization with AgentDB

```typescript
FUNCTION initializeSmartSwarm(
  topology: 'mesh' | 'hierarchical' | 'ring' | 'star',
  maxAgents: number,
  config: SwarmConfig
): Swarm

  // Initialize AgentDB for swarm memory
  agentDB = new AgentDB({
    path: config.dbPath || './swarm-memory.db',
    backend: 'ruvector', // 150x faster than SQLite
    features: {
      vectorSearch: true,
      graphDatabase: true,
      attentionMechanisms: ['hyperbolic', 'flash', 'linear', 'mha', 'moe'],
      gnnLearning: true,
      causalReasoning: true
    }
  });

  // Initialize ReasoningBank for meta-learning
  reasoningBank = new ReasoningBank(agentDB);

  // Load historical patterns for this topology
  patterns = await reasoningBank.searchPatterns(
    task: `swarm-${topology}`,
    k: 10
  );

  // Select optimal configuration based on learned patterns
  optimalConfig = selectOptimalConfig(patterns, config);

  // Initialize swarm with learned configuration
  swarm = {
    id: generateSwarmID(),
    topology: topology,
    maxAgents: maxAgents,
    agents: [],
    memory: agentDB,
    reasoningBank: reasoningBank,
    config: optimalConfig,
    metrics: initializeMetrics(),
    consensus: initializeConsensus(topology, config)
  };

  // If distributed, initialize QUIC synchronization
  IF config.distributed THEN
    swarm.quicServer = new QUICServer(config.quicPort);
    await swarm.quicServer.listen();

    // Join existing swarm or become leader
    swarm.role = await determineSwarmRole(swarm);
  END IF

  // Store swarm initialization in ReasoningBank
  await reasoningBank.storePattern({
    sessionId: swarm.id,
    task: `swarm-init-${topology}`,
    input: JSON.stringify(config),
    output: JSON.stringify(optimalConfig),
    reward: 1.0, // Will be updated based on performance
    success: true,
    tokensUsed: 0,
    latencyMs: Date.now() - startTime
  });

  RETURN swarm;
END FUNCTION
```

### Algorithm 2: Intelligent Agent Spawning with Smart Routing

```typescript
FUNCTION spawnIntelligentAgent(
  swarm: Swarm,
  type: AgentType,
  capabilities: string[],
  task: Task
): Agent

  // Query ReasoningBank for similar agent configurations
  historicalAgents = await swarm.reasoningBank.searchPatterns(
    task: `agent-${type}-${task.category}`,
    k: 5
  );

  // Analyze success rate and optimal configurations
  successfulPatterns = historicalAgents.filter(p => p.success && p.reward > 0.7);
  optimalCapabilities = extractOptimalCapabilities(successfulPatterns);

  // Merge requested capabilities with learned optimal ones
  finalCapabilities = mergeCapabilities(capabilities, optimalCapabilities);

  // Select optimal LLM provider using SmartRouter
  modelSelection = await swarm.llmRouter.selectModel({
    task: task,
    agentType: type,
    constraints: {
      maxCost: task.budget || 0.01,
      minQuality: task.qualityThreshold || 0.8,
      maxLatency: task.latencyThreshold || 5000,
      priority: task.priority || 'balanced'
    },
    historicalPerformance: extractModelPerformance(historicalAgents)
  });

  // Initialize agent with smart routing and AgentDB memory
  agent = {
    id: generateAgentID(),
    type: type,
    capabilities: finalCapabilities,
    llmProvider: modelSelection.provider,
    llmModel: modelSelection.model,
    memory: swarm.memory.createAgentMemoryView(agentId),
    reasoningBank: swarm.reasoningBank,
    agentBooster: new AgentBooster(), // For fast code edits
    metrics: initializeAgentMetrics(),
    state: 'idle'
  };

  // If distributed, sync agent state via QUIC
  IF swarm.config.distributed THEN
    await swarm.quicServer.broadcastAgentSpawn(agent);
  END IF

  // Add to swarm
  swarm.agents.push(agent);

  // Store spawn decision in ReasoningBank for future learning
  await swarm.reasoningBank.storePattern({
    sessionId: swarm.id,
    task: `agent-spawn-${type}`,
    input: JSON.stringify({ type, capabilities, task }),
    output: JSON.stringify({ finalCapabilities, modelSelection }),
    reward: 1.0, // Will be updated based on agent performance
    success: true,
    tokensUsed: 0,
    latencyMs: Date.now() - startTime
  });

  RETURN agent;
END FUNCTION
```

### Algorithm 3: Meta-Learning Task Orchestration

```typescript
FUNCTION orchestrateTaskWithMetaLearning(
  swarm: Swarm,
  task: Task,
  strategy: 'parallel' | 'sequential' | 'adaptive'
): TaskResult

  startTime = Date.now();

  // Step 1: Query ReasoningBank for similar tasks
  similarTasks = await swarm.reasoningBank.searchPatterns(
    task: task.description,
    k: 10
  );

  // Step 2: Analyze success patterns
  stats = await swarm.reasoningBank.getStats(task.description);

  IF stats.successRate > 0.8 THEN
    // High confidence - use best known approach
    bestPattern = stats.bestApproaches[0];
    executionPlan = createPlanFromPattern(bestPattern);
  ELSE
    // Low confidence - use adaptive exploration
    executionPlan = createAdaptivePlan(task, similarTasks, strategy);
  END IF

  // Step 3: Decompose task based on learned patterns
  subtasks = decomposeTask(task, executionPlan);

  // Step 4: Assign agents using learned agent-task matching
  agentAssignments = await assignAgentsToSubtasks(
    swarm,
    subtasks,
    historicalAssignments: extractAssignments(similarTasks)
  );

  // Step 5: Execute with attention-based coordination
  results = [];

  IF strategy == 'parallel' THEN
    // Parallel execution with hyperbolic attention for coordination
    results = await Promise.all(
      agentAssignments.map(async (assignment) => {
        result = await executeSubtask(assignment);

        // Use hyperbolic attention to update agent context
        await updateAgentContext(assignment.agent, result, 'hyperbolic');

        RETURN result;
      })
    );

  ELSE IF strategy == 'sequential' THEN
    // Sequential execution with flash attention for memory efficiency
    FOR EACH assignment IN agentAssignments DO
      result = await executeSubtask(assignment);

      // Use flash attention for efficient memory consolidation
      await consolidateMemory(swarm, result, 'flash');

      results.push(result);
    END FOR

  ELSE // adaptive
    // Adaptive execution with mixed attention strategies
    results = await adaptiveExecution(swarm, agentAssignments);
  END IF

  // Step 6: Synthesize results using graph neural networks
  finalResult = await synthesizeResults(results, {
    method: 'gnn',
    swarm: swarm,
    task: task
  });

  // Step 7: Compute reward and learn from outcome
  reward = computeReward(finalResult, task.expectedQuality);

  // Step 8: Store trajectory in ReasoningBank
  await swarm.reasoningBank.storePattern({
    sessionId: swarm.id,
    task: task.description,
    input: JSON.stringify(task),
    output: JSON.stringify(finalResult),
    reward: reward,
    success: reward > 0.7,
    critique: generateCritique(finalResult, task),
    tokensUsed: calculateTokens(results),
    latencyMs: Date.now() - startTime
  });

  // Step 9: If distributed, sync learning to other nodes via QUIC
  IF swarm.config.distributed THEN
    await swarm.quicServer.broadcastLearning({
      pattern: lastPattern,
      reward: reward,
      timestamp: Date.now()
    });
  END IF

  RETURN finalResult;
END FUNCTION
```

### Algorithm 4: Hyperbolic Attention for Hierarchical Memory

```typescript
FUNCTION retrieveHierarchicalMemory(
  swarm: Swarm,
  query: string,
  k: number,
  curvature: number = -1.0
): MemoryResult[]

  // Step 1: Embed query using attention service
  attentionService = swarm.memory.getAttentionService();
  queryEmbedding = await attentionService.embed(query);

  // Step 2: Perform hyperbolic attention over memory hierarchy
  // Hyperbolic space naturally represents hierarchies (tree-like data)
  hierarchicalResults = await attentionService.hyperbolicAttention(
    query: queryEmbedding,
    keys: swarm.memory.getAllMemoryEmbeddings(),
    values: swarm.memory.getAllMemoryData(),
    curvature: curvature // Negative curvature for Poincaré ball
  );

  // Step 3: Graph traversal for related memories
  graphQuery = `
    MATCH (m:Memory {id: $memoryIds})
    -[r:RELATED_TO|CAUSED_BY|SIMILAR_TO*1..3]->(related:Memory)
    RETURN related
    ORDER BY r.strength DESC
    LIMIT $k
  `;

  relatedMemories = await swarm.memory.graphQuery(graphQuery, {
    memoryIds: hierarchicalResults.slice(0, k).map(r => r.id),
    k: k
  });

  // Step 4: GNN-based re-ranking
  reranked = await swarm.memory.gnnRerank({
    query: queryEmbedding,
    candidates: relatedMemories,
    features: extractMemoryFeatures(relatedMemories)
  });

  // Step 5: Causal inference for explainability
  causalExplanations = await Promise.all(
    reranked.slice(0, k).map(async (memory) => {
      explanation = await swarm.memory.causalInference(
        cause: query,
        effect: memory.content
      );

      RETURN { memory, explanation };
    })
  );

  RETURN causalExplanations;
END FUNCTION
```

### Algorithm 5: Agent Booster Fast Code Editing

```typescript
FUNCTION fastCodeEdit(
  agent: Agent,
  filepath: string,
  editInstructions: string,
  codeWithMarkers: string
): EditResult

  startTime = Date.now();

  // Step 1: Use Agent Booster for ultra-fast local editing
  result = await agent.agentBooster.editFile({
    targetFilepath: filepath,
    instructions: editInstructions,
    codeEdit: codeWithMarkers,
    language: detectLanguage(filepath)
  });

  editLatency = Date.now() - startTime;

  // Step 2: Store edit pattern in ReasoningBank for learning
  await agent.reasoningBank.storePattern({
    sessionId: agent.swarm.id,
    task: `code-edit-${detectLanguage(filepath)}`,
    input: JSON.stringify({ filepath, editInstructions }),
    output: JSON.stringify(result),
    reward: result.success ? 1.0 : 0.0,
    success: result.success,
    tokensUsed: 0, // Agent Booster is local, no tokens
    latencyMs: editLatency
  });

  // Step 3: If successful, update agent's code editing skills
  IF result.success THEN
    await agent.memory.updateSkill({
      skill: 'code-editing',
      language: detectLanguage(filepath),
      successCount: agent.memory.getSkillSuccess('code-editing') + 1,
      averageLatency: editLatency
    });
  END IF

  RETURN result;
END FUNCTION
```

### Algorithm 6: Smart LLM Routing with Cost-Quality Optimization

```typescript
FUNCTION selectOptimalLLM(
  router: SmartRouter,
  task: Task,
  constraints: {
    maxCost: number,
    minQuality: number,
    maxLatency: number,
    priority: 'cost' | 'quality' | 'speed' | 'balanced'
  }
): ModelSelection

  // Step 1: Get historical performance for all providers
  performance = await router.getPerformanceStats({
    taskCategory: task.category,
    timeWindow: '7d'
  });

  // Step 2: Filter models by constraints
  viableModels = performance.filter(model =>
    model.avgCost <= constraints.maxCost &&
    model.avgQuality >= constraints.minQuality &&
    model.p95Latency <= constraints.maxLatency
  );

  IF viableModels.length == 0 THEN
    // Relax constraints and try again
    viableModels = performance.filter(model =>
      model.avgQuality >= constraints.minQuality * 0.9
    );
  END IF

  // Step 3: Score models based on priority
  scored = viableModels.map(model => {
    score = 0;

    SWITCH constraints.priority
      CASE 'cost':
        // Minimize cost, but consider quality
        score = (1 - model.avgCost / maxCost) * 0.7 + (model.avgQuality) * 0.3;

      CASE 'quality':
        // Maximize quality, but consider cost
        score = (model.avgQuality) * 0.7 + (1 - model.avgCost / maxCost) * 0.3;

      CASE 'speed':
        // Minimize latency, but consider quality
        score = (1 - model.p95Latency / maxLatency) * 0.7 + (model.avgQuality) * 0.3;

      CASE 'balanced':
        // Balanced optimization
        score = (1 - model.avgCost / maxCost) * 0.33 +
                (model.avgQuality) * 0.34 +
                (1 - model.p95Latency / maxLatency) * 0.33;
    END SWITCH

    RETURN { model, score };
  });

  // Step 4: Select best model
  bestModel = scored.sort((a, b) => b.score - a.score)[0];

  // Step 5: Epsilon-greedy exploration (10% of time, try random model)
  IF Math.random() < 0.1 THEN
    // Explore alternative models for learning
    randomModel = viableModels[Math.floor(Math.random() * viableModels.length)];
    RETURN {
      provider: randomModel.provider,
      model: randomModel.name,
      rationale: 'exploration',
      expectedCost: randomModel.avgCost,
      expectedQuality: randomModel.avgQuality,
      expectedLatency: randomModel.p95Latency
    };
  END IF

  // Step 6: Return best model
  RETURN {
    provider: bestModel.model.provider,
    model: bestModel.model.name,
    rationale: `optimized-for-${constraints.priority}`,
    expectedCost: bestModel.model.avgCost,
    expectedQuality: bestModel.model.avgQuality,
    expectedLatency: bestModel.model.p95Latency
  };
END FUNCTION
```

### Algorithm 7: QUIC-Based Distributed Synchronization

```typescript
FUNCTION synchronizeSwarmState(
  swarm: Swarm,
  localState: AgentState
): SyncResult

  IF NOT swarm.config.distributed THEN
    RETURN { synced: false, reason: 'not-distributed' };
  END IF

  // Step 1: Determine swarm role (leader or follower)
  IF swarm.role == 'leader' THEN
    // Leader broadcasts state to all followers
    await swarm.quicServer.broadcastState({
      swarmId: swarm.id,
      state: localState,
      timestamp: Date.now(),
      version: swarm.stateVersion++
    });

    RETURN { synced: true, role: 'leader' };

  ELSE // follower
    // Follower sends state to leader and waits for consensus
    response = await swarm.quicClient.sendState({
      swarmId: swarm.id,
      state: localState,
      timestamp: Date.now()
    });

    // Wait for leader's consensus decision
    consensusResult = await swarm.quicClient.waitForConsensus(
      timeout: 5000 // 5 second timeout
    );

    IF consensusResult.accepted THEN
      // State accepted, update local state
      await swarm.updateState(consensusResult.canonicalState);
      RETURN { synced: true, role: 'follower', accepted: true };
    ELSE
      // State rejected, rollback local changes
      await swarm.rollbackState(localState);
      RETURN { synced: true, role: 'follower', accepted: false };
    END IF
  END IF
END FUNCTION
```

### Algorithm 8: Byzantine Consensus for Adversarial Environments

```typescript
FUNCTION byzantineConsensus(
  swarm: Swarm,
  proposal: Proposal,
  threshold: number = 0.67
): ConsensusResult

  // Step 1: Broadcast proposal to all agents
  responses = await Promise.all(
    swarm.agents.map(async (agent) => {
      vote = await agent.evaluateProposal(proposal);
      signature = await agent.signVote(vote);

      RETURN {
        agentId: agent.id,
        vote: vote, // 'accept' or 'reject'
        signature: signature,
        timestamp: Date.now()
      };
    })
  );

  // Step 2: Verify all signatures (prevent tampering)
  verifiedVotes = responses.filter(response => {
    agent = swarm.agents.find(a => a.id === response.agentId);
    isValid = verifySignature(response.vote, response.signature, agent.publicKey);
    RETURN isValid;
  });

  // Step 3: Count votes
  acceptVotes = verifiedVotes.filter(v => v.vote === 'accept').length;
  totalVotes = verifiedVotes.length;
  acceptRatio = acceptVotes / totalVotes;

  // Step 4: Check if threshold met (e.g., 67% for Byzantine tolerance)
  consensus = acceptRatio >= threshold;

  // Step 5: Store consensus result in AgentDB
  await swarm.memory.storeConsensusResult({
    proposalId: proposal.id,
    consensus: consensus,
    acceptRatio: acceptRatio,
    threshold: threshold,
    votes: verifiedVotes,
    timestamp: Date.now()
  });

  // Step 6: If distributed, sync consensus via QUIC
  IF swarm.config.distributed THEN
    await swarm.quicServer.broadcastConsensus({
      proposalId: proposal.id,
      consensus: consensus,
      acceptRatio: acceptRatio
    });
  END IF

  RETURN {
    consensus: consensus,
    acceptRatio: acceptRatio,
    acceptVotes: acceptVotes,
    totalVotes: totalVotes,
    threshold: threshold,
    verifiedVotes: verifiedVotes
  };
END FUNCTION
```

### Algorithm 9: SIMD-Optimized Neural Inference

```typescript
FUNCTION runSIMDInference(
  model: NeuralModel,
  input: Float32Array
): Float32Array

  // Step 1: Detect SIMD capabilities
  simdSupport = detectSIMDSupport();

  IF simdSupport.wasm THEN
    // Use WebAssembly SIMD for browser/Node.js
    result = await model.wasmModule.inferWithSIMD(input);

  ELSE IF simdSupport.napi && (simdSupport.avx2 || simdSupport.neon) THEN
    // Use native SIMD via NAPI-RS
    result = await model.napiModule.inferWithNativeSIMD(input);

  ELSE
    // Fallback to regular JavaScript
    result = model.inferWithJS(input);
  END IF

  RETURN result;
END FUNCTION

// SIMD-optimized matrix multiplication
FUNCTION simdMatmul(
  A: Float32Array, // Matrix A (m x n)
  B: Float32Array, // Matrix B (n x p)
  m: number, n: number, p: number
): Float32Array

  result = new Float32Array(m * p);

  // Process 4 elements at a time using SIMD
  FOR i = 0 TO m - 1 DO
    FOR j = 0 TO p - 1 DO
      sum = 0.0f32x4; // SIMD vector of 4 floats

      FOR k = 0 TO n - 4 STEP 4 DO
        // Load 4 elements from A and B
        a_vec = simd.load(A, i * n + k);
        b_vec = simd.load(B, k * p + j, p); // Strided load

        // Multiply and accumulate using SIMD
        sum = simd.add(sum, simd.mul(a_vec, b_vec));
      END FOR

      // Sum the SIMD vector into a single value
      result[i * p + j] = simd.extractLane(sum, 0) +
                          simd.extractLane(sum, 1) +
                          simd.extractLane(sum, 2) +
                          simd.extractLane(sum, 3);
    END FOR
  END FOR

  RETURN result;
END FUNCTION
```

## 🔄 Data Flow Diagrams

### Data Flow 1: Task Execution with Meta-Learning

```
User Request
    │
    ├─> Parse Task
    │       │
    │       ├─> Query ReasoningBank for Similar Tasks
    │       │       │
    │       │       └─> Analyze Success Patterns
    │       │
    │       └─> Generate Execution Plan
    │
    ├─> Spawn Agents
    │       │
    │       ├─> Query Historical Agent Performance
    │       │       │
    │       │       └─> Select Optimal LLM (Smart Router)
    │       │
    │       ├─> Initialize with AgentDB Memory
    │       │
    │       └─> Assign Capabilities
    │
    ├─> Orchestrate Execution
    │       │
    │       ├─> Decompose into Subtasks
    │       │
    │       ├─> Assign Agents to Subtasks
    │       │
    │       ├─> Execute (Parallel/Sequential/Adaptive)
    │       │       │
    │       │       ├─> Use Attention Mechanisms for Coordination
    │       │       │   (Hyperbolic, Flash, Linear, etc.)
    │       │       │
    │       │       ├─> Use Agent Booster for Code Edits
    │       │       │   (352x faster than cloud APIs)
    │       │       │
    │       │       └─> Store Intermediate Results in AgentDB
    │       │
    │       └─> Synthesize Results (GNN)
    │
    ├─> Learn from Outcome
    │       │
    │       ├─> Compute Reward
    │       │
    │       ├─> Store Trajectory in ReasoningBank
    │       │
    │       └─> Update Agent Skills in AgentDB
    │
    └─> Return Result to User
```

### Data Flow 2: Distributed Consensus with QUIC

```
Agent Proposal
    │
    ├─> Local Validation
    │       │
    │       └─> Sign with Private Key (Ed25519)
    │
    ├─> Broadcast to Swarm via QUIC
    │       │
    │       ├─> Leader Node Receives Proposal
    │       │       │
    │       │       ├─> Forward to All Followers
    │       │       │
    │       │       └─> Collect Votes (QUIC Streams)
    │       │
    │       └─> Follower Nodes Receive Proposal
    │               │
    │               ├─> Evaluate Proposal
    │               │
    │               ├─> Sign Vote
    │               │
    │               └─> Send Vote to Leader via QUIC
    │
    ├─> Leader Performs Byzantine Consensus
    │       │
    │       ├─> Verify All Signatures
    │       │
    │       ├─> Count Valid Votes
    │       │
    │       ├─> Check Threshold (e.g., 67%)
    │       │
    │       └─> Determine Consensus Result
    │
    ├─> Broadcast Consensus Decision
    │       │
    │       └─> All Nodes Update State via QUIC
    │
    └─> Store in AgentDB (Distributed Log)
            │
            └─> QUIC Sync to All Nodes
```

### Data Flow 3: Smart LLM Routing

```
Task Request
    │
    ├─> Analyze Task Characteristics
    │       │
    │       ├─> Extract Category, Complexity, Length
    │       │
    │       └─> Determine Constraints (Cost, Quality, Latency)
    │
    ├─> Query Historical Performance
    │       │
    │       └─> Get Model Stats from AgentDB
    │               │
    │               ├─> Average Cost per Task Category
    │               ├─> Average Quality Score
    │               ├─> P95 Latency
    │               └─> Success Rate
    │
    ├─> Filter Viable Models
    │       │
    │       └─> Apply Constraints
    │               │
    │               ├─> Max Cost Filter
    │               ├─> Min Quality Filter
    │               └─> Max Latency Filter
    │
    ├─> Score and Rank Models
    │       │
    │       └─> Apply Scoring Function Based on Priority
    │               │
    │               ├─> Cost-Optimized Scoring
    │               ├─> Quality-Optimized Scoring
    │               ├─> Speed-Optimized Scoring
    │               └─> Balanced Scoring
    │
    ├─> Select Best Model (or Explore)
    │       │
    │       ├─> 90% Exploitation (Best Model)
    │       │
    │       └─> 10% Exploration (Random Model for Learning)
    │
    ├─> Execute Task with Selected Model
    │       │
    │       └─> Track Performance Metrics
    │
    └─> Update Model Statistics in AgentDB
            │
            ├─> Actual Cost
            ├─> Actual Quality Score
            ├─> Actual Latency
            └─> Success/Failure
```

## 📊 Complexity Analysis

### Time Complexity

| Algorithm | Best Case | Average Case | Worst Case | Space |
|-----------|-----------|--------------|------------|-------|
| Smart Swarm Init | O(1) | O(log n) | O(n) | O(n) |
| Agent Spawn | O(1) | O(log k) | O(k) | O(1) |
| Meta-Learning Orchestration | O(n) | O(n log n) | O(n²) | O(n) |
| Hyperbolic Attention | O(n²) | O(n²) | O(n²) | O(n) |
| Agent Booster Edit | O(1) | O(m) | O(m) | O(m) |
| Smart LLM Routing | O(k) | O(k log k) | O(k²) | O(k) |
| QUIC Sync | O(1) | O(log n) | O(n) | O(1) |
| Byzantine Consensus | O(n) | O(n log n) | O(n²) | O(n) |
| SIMD Inference | O(n) | O(n) | O(n) | O(n) |

*Where n = number of agents, k = number of models, m = lines of code*

### Performance Targets

- **Agent Spawn**: <10ms (O(log k) database lookup)
- **Task Orchestration**: <50ms (O(n log n) with smart routing)
- **Memory Retrieval**: <5ms (O(log n) with AgentDB indexing)
- **Code Edit**: <5ms (O(m) with Agent Booster)
- **LLM Selection**: <10ms (O(k log k) with cached stats)
- **QUIC Sync**: <20ms (O(log n) with bidirectional streams)
- **Consensus**: <100ms (O(n log n) with parallel voting)

## 📖 Next Steps

Proceed to **[SPARC Phase 3: Architecture](03-architecture.md)** for detailed system design and component interactions.

---

**Status**: Planning
**Phase**: SPARC 2 - Pseudocode
**Version**: 2.0.0-planning
**Last Updated**: 2025-12-02

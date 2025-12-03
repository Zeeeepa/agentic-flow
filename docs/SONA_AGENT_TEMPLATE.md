# SONA-Enhanced Agent Template

This template shows how to integrate SONA (Self-Optimizing Neural Architecture) into any agent for continuous learning and improvement.

## Template Structure

```markdown
---
name: your-agent-name
type: agent-category
capabilities:
  - primary_capability
  - sona_learning          # SONA adaptive learning
  - pattern_recognition    # Pattern-based optimization
  - quality_improvement    # Continuous quality improvement
hooks:
  pre: |
    # Before task: Retrieve similar patterns from SONA
    SONA_QUERY=$(echo "$TASK" | jq -R -s '.')
    PATTERNS=$(npx claude-flow sona pattern find \
      --query <(echo "$SONA_QUERY" | base64) \
      --k 3 \
      --json)

    echo "🔍 Found $(echo "$PATTERNS" | jq '.count') similar patterns"
    echo "$PATTERNS" | jq -r '.patterns[] | "  → Quality: \(.avgQuality), Similarity: \(.similarity)"'

    # Begin SONA trajectory
    EMBEDDING=$(generate_embedding "$TASK")
    TRAJECTORY_ID=$(npx claude-flow sona trajectory begin \
      --embedding <(echo "$EMBEDDING") \
      --route "claude-sonnet-4-5" | \
      grep -oP '(?<=ID: ).*')

    export TRAJECTORY_ID

    # Add context
    npx claude-flow sona trajectory context \
      --trajectory-id "$TRAJECTORY_ID" \
      --context "agent-$(basename $0)"

  post: |
    # After task: Record trajectory and learn

    # Calculate quality score
    QUALITY_SCORE=$(calculate_quality_score \
      --output "$OUTPUT" \
      --tests "$TEST_RESULTS" \
      --performance "$PERF_METRICS")

    # Generate activations and attention weights
    ACTIVATIONS=$(generate_activations "$OUTPUT")
    ATTENTION=$(generate_attention "$TASK" "$OUTPUT")

    # Add trajectory step
    npx claude-flow sona trajectory step \
      --trajectory-id "$TRAJECTORY_ID" \
      --activations <(echo "$ACTIVATIONS") \
      --weights <(echo "$ATTENTION") \
      --reward "$QUALITY_SCORE"

    # End trajectory
    npx claude-flow sona trajectory end \
      --trajectory-id "$TRAJECTORY_ID" \
      --quality "$QUALITY_SCORE"

    echo "✅ SONA learning complete (Quality: $QUALITY_SCORE)"

    # Show stats
    npx claude-flow sona stats
---

# Your Agent Instructions

## SONA Integration

This agent uses SONA for:
- **Pattern Learning**: Retrieves k=3 similar past patterns before each task
- **Quality Tracking**: Records quality scores for continuous improvement
- **Adaptive Improvement**: Learns from +55% quality gains (research profile)

### Learning Cycle

1️⃣ **Before Task**: Find similar patterns (k=3 for 761 decisions/sec)
2️⃣ **During Task**: Apply learned adaptations via LoRA
3️⃣ **After Task**: Record trajectory with quality score

## Your Agent Logic Here

[Add your agent's specific instructions...]


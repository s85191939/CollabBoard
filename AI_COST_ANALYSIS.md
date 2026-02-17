# AI Cost Analysis - CollabBoard

## Development & Testing Costs

| Category | Cost |
|----------|------|
| Claude Max subscription (Claude Code + claude.ai) | $100/month (flat rate, not per-token) |
| Anthropic API (testing AI commands) | ~$0.50 (minimal testing) |
| Firebase (Spark free tier) | $0 |
| Render (free tier) | $0 |
| **Total development cost** | **~$100.50** |

### Token Usage During Development
- Claude Code session: Included in Claude Max subscription (not metered per token)
- Anthropic API testing: ~5 AI commands during testing
  - Average ~2,000 input tokens + ~500 output tokens per command
  - Estimated: 10,000 input + 2,500 output tokens total
  - Cost at claude-sonnet-4-20250514 pricing ($3/1M input, $15/1M output): ~$0.07

## Production Cost Projections

### Assumptions
- Average AI commands per user per session: 5
- Average sessions per user per month: 8
- Average tokens per AI command: 2,000 input + 500 output
- Claude claude-sonnet-4-20250514 pricing: $3/1M input tokens, $15/1M output tokens
- Firestore pricing: $0.06/100K reads, $0.18/100K writes
- Average Firestore operations per session: 200 reads + 50 writes (objects, cursors, presence)

### Cost Breakdown by Scale

#### 100 Users — ~$5/month

| Service | Calculation | Cost |
|---------|------------|------|
| Anthropic API | 100 users x 8 sessions x 5 commands x (2K in + 500 out) tokens | $3.00 |
| Firestore reads | 100 x 8 x 200 = 160K reads | $0.10 |
| Firestore writes | 100 x 8 x 50 = 40K writes | $0.07 |
| Firebase Hosting | Within free tier | $0 |
| Firebase Auth | Free | $0 |
| Render (starter) | Upgrade for always-on | $7.00 |
| **Total** | | **~$10/month** |

#### 1,000 Users — ~$60/month

| Service | Calculation | Cost |
|---------|------------|------|
| Anthropic API | 1K x 8 x 5 x (2K in + 500 out) | $30.00 |
| Firestore reads | 1K x 8 x 200 = 1.6M reads | $0.96 |
| Firestore writes | 1K x 8 x 50 = 400K writes | $0.72 |
| Firebase Hosting | ~$2/month bandwidth | $2.00 |
| Firebase Auth | Free | $0 |
| Render (pro) | Higher compute needs | $25.00 |
| **Total** | | **~$59/month** |

#### 10,000 Users — ~$450/month

| Service | Calculation | Cost |
|---------|------------|------|
| Anthropic API | 10K x 8 x 5 x (2K in + 500 out) | $300.00 |
| Firestore reads | 10K x 8 x 200 = 16M reads | $9.60 |
| Firestore writes | 10K x 8 x 50 = 4M writes | $7.20 |
| Firebase Hosting | ~$10/month bandwidth | $10.00 |
| Firebase Auth | Free | $0 |
| Render/Cloud Run | Auto-scaling needed | $75.00 |
| **Total** | | **~$402/month** |

#### 100,000 Users — ~$3,700/month

| Service | Calculation | Cost |
|---------|------------|------|
| Anthropic API | 100K x 8 x 5 x (2K in + 500 out) | $3,000.00 |
| Firestore reads | 100K x 8 x 200 = 160M reads | $96.00 |
| Firestore writes | 100K x 8 x 50 = 40M writes | $72.00 |
| Firebase Hosting | ~$50/month bandwidth | $50.00 |
| Firebase Auth | Free | $0 |
| Cloud Run (multi-instance) | Auto-scaling, load balancing | $300.00 |
| **Total** | | **~$3,518/month** |

### Summary

| Scale | Monthly Cost | Cost per User |
|-------|-------------|---------------|
| 100 users | ~$10 | $0.10 |
| 1,000 users | ~$59 | $0.06 |
| 10,000 users | ~$402 | $0.04 |
| 100,000 users | ~$3,518 | $0.04 |

### Key Observations

1. **Anthropic API is the dominant cost** — Accounts for 75-85% of total costs at every scale. Optimizing prompt length and caching responses would have the biggest impact.
2. **Firebase scales affordably** — Firestore reads/writes are cheap even at 100K users (~$168/month). Firebase Auth is free at any scale.
3. **Cost per user decreases with scale** — Fixed costs (hosting, server) are amortized across more users.
4. **Optimization opportunities**:
   - Prompt caching for repeated template commands (SWOT, retro boards)
   - Use Claude Haiku for simple commands ($0.25/1M input) — 12x cheaper
   - Rate limiting to prevent abuse
   - Client-side caching of AI responses for identical prompts

# AI Development Log - CollabBoard

## Tools & Workflow

- **Claude Code** (primary): Used as the main development tool for the entire project. Claude Code scaffolded the monorepo, created all React components, hooks, pages, the FastAPI backend, and deployment configs. Used parallel background agents to create multiple files simultaneously for speed.
- **Claude.ai** (Claude Max subscription): Used for Pre-Search architecture decisions, exploring tradeoffs between Firebase vs Supabase, Konva.js vs Fabric.js, and deployment options.

## MCP Usage

- No external MCP integrations were used during development. Firebase and Anthropic APIs were integrated directly via their SDKs.

## Effective Prompts

1. **"build"** (with Pre-Search PDF attached)
   - One-word prompt that kicked off the entire project scaffold. Claude Code read the architecture decisions from the PDF and built the full monorepo structure, all components, hooks, backend, and types.

2. **"Create a SWOT analysis template with four quadrants"** (AI agent test)
   - Used to test the Claude tool-calling system. The AI agent created 4 frames with labels and positioned sticky notes inside each quadrant using multi-turn tool calls.

3. **Iterative error fixing** — After the initial build, ran `tsc --noEmit` and fed TypeScript errors back to Claude Code. It fixed 10 type errors across 6 files in sequence (unused imports, type-only imports, union type mismatches, dynamic import issues).

4. **"Remove firebase-admin dependency, use JWT decode for auth"**
   - When the backend crashed on Render due to missing Google Cloud credentials, described the constraint and Claude Code refactored the auth to use simple JWT decoding instead.

5. **"Add copy/paste functionality"**
   - Added Cmd+C/Cmd+V support with clipboard state, paste offset, and keyboard shortcut conflict resolution (V/C keys for tools vs Cmd+V/Cmd+C for paste/copy).

## Code Analysis

| Category | Percentage |
|----------|-----------|
| AI-generated (Claude Code) | ~95% |
| Hand-written / manually edited | ~5% |

The 5% hand-written code was primarily: environment variable configuration, Firebase console setup, Render dashboard configuration, and minor manual tweaks during debugging.

## Strengths & Limitations

### Where AI Excelled
- **Scaffolding**: Generated the entire project structure (35+ files) in minutes
- **Parallel execution**: Created multiple files simultaneously using background agents
- **TypeScript**: Fixed complex type errors (union types, verbatimModuleSyntax) efficiently
- **Architecture**: Made sound decisions about Firestore data modeling (subcollections for objects/cursors/presence)
- **Integration code**: Firebase SDK setup, Anthropic tool-calling schema, Konva.js rendering logic

### Where AI Struggled
- **Deployment issues**: Didn't anticipate that firebase-admin would need Google Cloud credentials on Render
- **Unused code**: Generated imports and variables that weren't used (10 TypeScript errors on first build)
- **Environment awareness**: Couldn't test the actual running app, so some integration issues only surfaced at runtime (Firestore composite index requirement)

## Key Learnings

1. **One prompt can scaffold an entire app** — Attaching architecture docs to a simple "build" command produced a complete, working codebase. Pre-Search was essential for this.
2. **AI generates code faster than you can read it** — The bottleneck shifts from writing to reviewing and testing.
3. **Deployment is where AI struggles most** — Local development went smoothly, but platform-specific constraints (Render credentials, Firestore indexes) required iterative debugging.
4. **Type checking is your safety net** — Running `tsc --noEmit` after AI generation caught 10 errors immediately. Without TypeScript, these would have been runtime bugs.
5. **The AI-first workflow is: describe → generate → verify → fix → deploy** — Each cycle gets faster as the AI learns the codebase context.

# Spazzatura Architecture

**Version:** 1.0.0  
**Date:** March 21, 2026  
**Status:** Design Phase

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Overview](#2-system-overview)
3. [Core Components](#3-core-components)
4. [Module Structure](#4-module-structure)
5. [Data Flow](#5-data-flow)
6. [LLM Provider Abstraction](#6-llm-provider-abstraction)
7. [Extension Points](#7-extension-points)
8. [Configuration Schema](#8-configuration-schema)
9. [CLI Command Design](#9-cli-command-design)
10. [Technology Stack](#10-technology-stack)
11. [Implementation Phases](#11-implementation-phases)

---

## 1. Executive Summary

Spazzatura is a comprehensive CLI coding tool that unifies the best features from five existing tools:

| Source Tool | Key Features Integrated |
|-------------|------------------------|
| **Codebuff** | Streaming responses, undo/redo, template system, lightweight design |
| **Oh-My-OpenAgent** | Multi-agent orchestration, tool integration, agent marketplace, visual workflow builder, evaluation framework |
| **Claude Code** | MCP support, extended thinking, tool use, artifact generation |
| **Superpowers** | Modular skills system, skill marketplace, parallel review, mode switching |
| **OpenSpec** | YAML/Markdown specs, bidirectional sync, contract testing |

### Design Principles

1. **Unified Interface** - Single CLI entry point with intuitive subcommands
2. **Provider Agnostic** - Seamless failover between LLM providers
3. **Extensible Architecture** - Plugin-based skills, agents, and tools
4. **Spec-Driven** - Optional specification-first development workflow
5. **Zero Cost by Default** - Integrated free LLM provider support

---

## 2. System Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            SPAZZATURA CLI                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                         CLI Interface Layer                           │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐        │   │
│  │  │  chat   │ │  agent  │ │  skill  │ │  spec   │ │  mcp    │        │   │
│  │  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘        │   │
│  └───────┼──────────┼──────────┼──────────┼──────────┼─────────────────┘   │
│          │          │          │          │          │                     │
│  ┌───────▼──────────▼──────────▼──────────▼──────────▼─────────────────┐   │
│  │                      Command Router                                   │   │
│  └───────┬──────────┬──────────┬──────────┬──────────┬─────────────────┘   │
│          │          │          │          │          │                     │
│  ┌───────▼──────────▼──────────▼──────────▼──────────▼─────────────────┐   │
│  │                      Core Services Layer                              │   │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐       │   │
│  │  │   Agent    │ │   Skill    │ │    Spec    │ │    MCP     │       │   │
│  │  │ Orchestr.  │ │  Engine    │ │  Engine    │ │  Manager   │       │   │
│  │  └─────┬──────┘ └─────┬──────┘ └─────┬──────┘ └─────┬──────┘       │   │
│  │        │              │              │              │               │   │
│  │  ┌─────▼──────┐ ┌─────▼──────┐ ┌─────▼──────┐ ┌─────▼──────┐       │   │
│  │  │  Template  │ │  Workflow  │ │ Validation │ │  Artifact  │       │   │
│  │  │  Engine    │ │  Builder   │ │  Framework │ │  Manager   │       │   │
│  │  └────────────┘ └────────────┘ └────────────┘ └────────────┘       │   │
│  └───────┬──────────────────────────────────────────────────┬─────────┘   │
│          │                                                  │             │
│  ┌───────▼──────────────────────────────────────────────────▼─────────┐   │
│  │                      LLM Abstraction Layer                           │   │
│  │  ┌─────────────────────────────────────────────────────────────┐   │   │
│  │  │                    Provider Router                            │   │   │
│  │  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │   │   │
│  │  │  │ Failover│  │ Load    │  │ Feature │  │  Health │        │   │   │
│  │  │  │ Manager │  │ Balancer│  │ Mapping │  │  Check  │        │   │   │
│  │  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘        │   │   │
│  │  └─────────────────────────────────────────────────────────────┘   │   │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐           │   │
│  │  │minimax │ │  qwen  │ │gpt4free│ │  glm   │ │ custom │           │   │
│  │  │-free   │ │ -free  │ │  -ts   │ │ -free  │ │provider│           │   │
│  │  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘           │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      Infrastructure Layer                             │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │   │
│  │  │  Config  │ │  Logger  │ │  State   │ │  Cache   │ │  Plugin  │  │   │
│  │  │ Manager  │ │  System  │ │ Manager  │ │ Manager  │ │ Loader   │  │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### System Context Diagram

```
                    ┌─────────────────┐
                    │   Developer     │
                    │   Terminal      │
                    └────────┬────────┘
                             │
                             ▼
┌────────────────────────────────────────────────────────────┐
│                                                            │
│                     SPAZZATURA                             │
│                                                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │   CLI    │  │  Config  │  │  Skills  │  │  Agents  │  │
│  │ Interface│  │  Files   │  │  Market  │  │  Market  │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
│                                                            │
└───────────────────────────┬────────────────────────────────┘
                            │
            ┌───────────────┼───────────────┐
            │               │               │
            ▼               ▼               ▼
     ┌──────────┐    ┌──────────┐    ┌──────────┐
     │  MiniMax │    │   Qwen   │    │  GPT4Free│
     │   API    │    │   API    │    │    TS    │
     └──────────┘    └──────────┘    └──────────┘
```

---

## 3. Core Components

### 3.1 CLI Interface Layer

The entry point for all user interactions, providing a unified command structure.

```
┌─────────────────────────────────────────────────────────────┐
│                    CLI Interface Layer                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Components:                                                 │
│  ├── Command Parser ............ Parses CLI arguments       │
│  ├── Command Router ............ Routes to handlers         │
│  ├── Output Formatter .......... Formats responses          │
│  ├── Interactive Mode .......... REPL interface             │
│  └── Progress Indicator ........ Visual feedback            │
│                                                              │
│  Features:                                                   │
│  ├── Auto-completion .......... Tab completion              │
│  ├── Syntax highlighting ...... Colorized output            │
│  ├── History management ....... Command history              │
│  └── Help system .............. Contextual help             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Agent Orchestration Engine

Multi-agent coordination system derived from Oh-My-OpenAgent.

```
┌─────────────────────────────────────────────────────────────┐
│                 Agent Orchestration Engine                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                  Agent Registry                       │    │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐   │    │
│  │  │  Coder  │ │Reviewer │ │ Tester  │ │ Analyst │   │    │
│  │  │  Agent  │ │  Agent  │ │  Agent  │ │  Agent  │   │    │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘   │    │
│  └─────────────────────────────────────────────────────┘    │
│                          │                                   │
│                          ▼                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              Orchestration Strategies                 │    │
│  │  ├── Sequential ........... One agent at a time      │    │
│  │  ├── Parallel ............. Multiple agents together  │    │
│  │  ├── Pipeline ............. Output chaining          │    │
│  │  └── Hierarchical ......... Manager-worker pattern   │    │
│  └─────────────────────────────────────────────────────┘    │
│                          │                                   │
│                          ▼                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                  Tool Integration                     │    │
│  │  ├── File Operations .... Read, write, edit          │    │
│  │  ├── Code Execution ..... Sandboxed runtime          │    │
│  │  ├── Web Search ......... External knowledge         │    │
│  │  └── Custom Tools ....... Plugin system              │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  Memory Systems:                                             │
│  ├── Conversation Memory ..... Session context             │
│  ├── Vector Memory ........... Long-term storage           │
│  └── Working Memory .......... Task-specific state         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 3.3 Skill Engine

Modular skill system derived from Superpowers.

```
┌─────────────────────────────────────────────────────────────┐
│                       Skill Engine                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                  Skill Registry                       │    │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │    │
│  │  │ code-review │ │  test-gen   │ │  refactor   │   │    │
│  │  └─────────────┘ └─────────────┘ └─────────────┘   │    │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │    │
│  │  │  document   │ │  security   │ │  optimize   │   │    │
│  │  └─────────────┘ └─────────────┘ └─────────────┘   │    │
│  └─────────────────────────────────────────────────────┘    │
│                          │                                   │
│  Skill Lifecycle:                                            │
│  ├── Discovery .............. Find available skills         │
│  ├── Loading ................ Load skill definition         │
│  ├── Validation ............. Check dependencies           │
│  ├── Execution .............. Run skill logic              │
│  └── Cleanup ................. Release resources           │
│                                                              │
│  Skill Composition:                                          │
│  ├── Prompts ................. System instructions         │
│  ├── Tools ................... Available capabilities       │
│  ├── Modes ................... Behavior variants            │
│  └── Dependencies ............ Required skills              │
│                                                              │
│  Parallel Review:                                            │
│  ├── Multiple perspectives on code                          │
│  ├── Configurable reviewers                                 │
│  └── Aggregated results                                     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 3.4 Specification Engine

Spec-driven development from OpenSpec.

```
┌─────────────────────────────────────────────────────────────┐
│                    Specification Engine                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Spec Format:                                                │
│  ├── YAML ................... Primary format                │
│  ├── Markdown ................ Documentation format          │
│  └── JSON ................... Machine-readable              │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                  Spec Pipeline                        │    │
│  │                                                       │    │
│  │  ┌─────────┐    ┌─────────┐    ┌─────────┐          │    │
│  │  │  Create │───▶│ Validate│───▶│ Generate│          │    │
│  │  └─────────┘    └─────────┘    └─────────┘          │    │
│  │       │              │              │                │    │
│  │       ▼              ▼              ▼                │    │
│  │  ┌─────────┐    ┌─────────┐    ┌─────────┐          │    │
│  │  │  Sync   │    │  Test   │    │Document │          │    │
│  │  └─────────┘    └─────────┘    └─────────┘          │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  Bidirectional Sync:                                         │
│  ├── Spec → Code ............ Code generation               │
│  ├── Code → Spec ............ Spec extraction               │
│  └── Conflict Resolution .... Merge strategies              │
│                                                              │
│  Contract Testing:                                           │
│  ├── Schema validation                                       │
│  ├── Behavior verification                                   │
│  └── Regression detection                                    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 3.5 MCP Manager

Model Context Protocol support from Claude Code.

```
┌─────────────────────────────────────────────────────────────┐
│                       MCP Manager                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                MCP Server Registry                    │    │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │    │
│  │  │ filesystem  │ │   github    │ │   postgres  │   │    │
│  │  └─────────────┘ └─────────────┘ └─────────────┘   │    │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │    │
│  │  │   memory    │ │   brave     │ │   custom    │   │    │
│  │  └─────────────┘ └─────────────┘ └─────────────┘   │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  Server Lifecycle:                                           │
│  ├── Discovery .............. Find MCP servers              │
│  ├── Connection ............. Establish communication       │
│  ├── Capability Negotiation . Exchange features             │
│  ├── Tool Registration ...... Expose tools to agents        │
│  └── Shutdown ................ Clean disconnection          │
│                                                              │
│  Protocol Features:                                          │
│  ├── Tools .................. Function calling              │
│  ├── Resources .............. Data access                   │
│  ├── Prompts ................ Template prompts               │
│  └── Sampling ................ LLM requests                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 3.6 Template Engine

Code generation templates from Codebuff.

```
┌─────────────────────────────────────────────────────────────┐
│                     Template Engine                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Template Sources:                                           │
│  ├── Built-in ................ Default templates            │
│  ├── User .................... Custom templates             │
│  ├── Project ................ Project-specific              │
│  └── Marketplace ............. Community templates          │
│                                                              │
│  Template Structure:                                         │
│  ├── metadata ................ Name, version, description   │
│  ├── variables ................ Input parameters            │
│  ├── prompts .................. System instructions         │
│  ├── files .................... Output file templates       │
│  └── hooks .................... Pre/post generation         │
│                                                              │
│  Variable System:                                            │
│  ├── Simple substitution ..... {{variable}}                │
│  ├── Conditionals ............ {{#if}}...{{/if}}           │
│  ├── Loops ................... {{#each}}...{{/each}}        │
│  └── Helpers .................. Custom functions            │
│                                                              │
│  Output Generation:                                          │
│  ├── Single file ............. One output                  │
│  ├── Multi-file .............. Directory structure         │
│  └── Interactive ............. User prompts                │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Module Structure

### Directory Layout

```
spazzatura/
├── packages/
│   ├── core/                          # Core functionality
│   │   ├── src/
│   │   │   ├── index.ts               # Public API
│   │   │   ├── types/                 # TypeScript types
│   │   │   │   ├── index.ts
│   │   │   │   ├── agent.ts
│   │   │   │   ├── skill.ts
│   │   │   │   ├── spec.ts
│   │   │   │   ├── provider.ts
│   │   │   │   └── config.ts
│   │   │   ├── config/                # Configuration management
│   │   │   │   ├── index.ts
│   │   │   │   ├── loader.ts
│   │   │   │   ├── validator.ts
│   │   │   │   └── defaults.ts
│   │   │   ├── logger/                # Logging system
│   │   │   │   ├── index.ts
│   │   │   │   ├── console.ts
│   │   │   │   └── file.ts
│   │   │   ├── state/                 # State management
│   │   │   │   ├── index.ts
│   │   │   │   ├── store.ts
│   │   │   │   └── persistence.ts
│   │   │   └── utils/                 # Utility functions
│   │   │       ├── index.ts
│   │   │       ├── async.ts
│   │   │       ├── string.ts
│   │   │       └── file.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── cli/                           # CLI interface
│   │   ├── src/
│   │   │   ├── index.ts               # Entry point
│   │   │   ├── commands/              # Command handlers
│   │   │   │   ├── index.ts
│   │   │   │   ├── chat.ts
│   │   │   │   ├── agent.ts
│   │   │   │   ├── skill.ts
│   │   │   │   ├── spec.ts
│   │   │   │   ├── mcp.ts
│   │   │   │   ├── config.ts
│   │   │   │   └── template.ts
│   │   │   ├── parser/                # Argument parsing
│   │   │   │   ├── index.ts
│   │   │   │   └── options.ts
│   │   │   ├── output/                # Output formatting
│   │   │   │   ├── index.ts
│   │   │   │   ├── formatter.ts
│   │   │   │   ├── highlight.ts
│   │   │   │   └── stream.ts
│   │   │   └── interactive/           # Interactive mode
│   │   │       ├── index.ts
│   │   │       ├── repl.ts
│   │   │       ├── completion.ts
│   │   │       └── history.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── agent/                         # Agent orchestration
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── registry/              # Agent registry
│   │   │   │   ├── index.ts
│   │   │   │   └── loader.ts
│   │   │   ├── orchestrator/          # Orchestration engine
│   │   │   │   ├── index.ts
│   │   │   │   ├── sequential.ts
│   │   │   │   ├── parallel.ts
│   │   │   │   ├── pipeline.ts
│   │   │   │   └── hierarchical.ts
│   │   │   ├── memory/                # Memory systems
│   │   │   │   ├── index.ts
│   │   │   │   ├── conversation.ts
│   │   │   │   ├── vector.ts
│   │   │   │   └── working.ts
│   │   │   ├── tools/                 # Built-in tools
│   │   │   │   ├── index.ts
│   │   │   │   ├── file.ts
│   │   │   │   ├── execute.ts
│   │   │   │   ├── search.ts
│   │   │   │   └── git.ts
│   │   │   └── marketplace/            # Agent marketplace
│   │   │       ├── index.ts
│   │   │       └── client.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── skill/                         # Skill system
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── registry/              # Skill registry
│   │   │   │   ├── index.ts
│   │   │   │   └── loader.ts
│   │   │   ├── engine/                # Skill execution
│   │   │   │   ├── index.ts
│   │   │   │   ├── executor.ts
│   │   │   │   ├── validator.ts
│   │   │   │   └── composer.ts
│   │   │   ├── modes/                 # Mode management
│   │   │   │   ├── index.ts
│   │   │   │   └── manager.ts
│   │   │   ├── review/                # Parallel review
│   │   │   │   ├── index.ts
│   │   │   │   └── aggregator.ts
│   │   │   └── marketplace/            # Skill marketplace
│   │   │       ├── index.ts
│   │   │       └── client.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── spec/                          # Specification engine
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── parser/                # Spec parsing
│   │   │   │   ├── index.ts
│   │   │   │   ├── yaml.ts
│   │   │   │   ├── markdown.ts
│   │   │   │   └── json.ts
│   │   │   ├── generator/             # Code generation
│   │   │   │   ├── index.ts
│   │   │   │   └── templates.ts
│   │   │   ├── validator/             # Spec validation
│   │   │   │   ├── index.ts
│   │   │   │   └── schema.ts
│   │   │   ├── sync/                  # Bidirectional sync
│   │   │   │   ├── index.ts
│   │   │   │   ├── spec-to-code.ts
│   │   │   │   └── code-to-spec.ts
│   │   │   └── contract/              # Contract testing
│   │   │       ├── index.ts
│   │   │       └── tester.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── mcp/                           # MCP integration
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── manager/               # Server management
│   │   │   │   ├── index.ts
│   │   │   │   ├── discovery.ts
│   │   │   │   ├── connection.ts
│   │   │   │   └── lifecycle.ts
│   │   │   ├── protocol/              # MCP protocol
│   │   │   │   ├── index.ts
│   │   │   │   ├── client.ts
│   │   │   │   ├── transport.ts
│   │   │   │   └── types.ts
│   │   │   └── tools/                 # Tool integration
│   │   │       ├── index.ts
│   │   │       └── wrapper.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── provider/                      # LLM provider abstraction
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── types/                 # Provider types
│   │   │   │   ├── index.ts
│   │   │   │   ├── message.ts
│   │   │   │   ├── response.ts
│   │   │   │   └── stream.ts
│   │   │   ├── base/                  # Base provider
│   │   │   │   ├── index.ts
│   │   │   │   └── openai-compatible.ts
│   │   │   ├── providers/             # Provider implementations
│   │   │   │   ├── index.ts
│   │   │   │   ├── minimax.ts
│   │   │   │   ├── qwen.ts
│   │   │   │   ├── gpt4free.ts
│   │   │   │   ├── glm.ts
│   │   │   │   └── custom.ts
│   │   │   ├── router/                # Provider routing
│   │   │   │   ├── index.ts
│   │   │   │   ├── failover.ts
│   │   │   │   ├── load-balancer.ts
│   │   │   │   └── health-check.ts
│   │   │   └── features/              # Feature mapping
│   │   │       ├── index.ts
│   │   │       └── mapper.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── template/                      # Template engine
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── engine/                # Template processing
│   │   │   │   ├── index.ts
│   │   │   │   ├── parser.ts
│   │   │   │   └── renderer.ts
│   │   │   ├── variables/             # Variable handling
│   │   │   │   ├── index.ts
│   │   │   │   └── helpers.ts
│   │   │   └── builtins/              # Built-in templates
│   │   │       ├── index.ts
│   │   │       ├── component.ts
│   │   │       ├── api.ts
│   │   │       └── test.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── artifacts/                     # Artifact management
│       ├── src/
│       │   ├── index.ts
│       │   ├── manager/               # Artifact lifecycle
│       │   │   ├── index.ts
│       │   │   ├── create.ts
│       │   │   ├── update.ts
│       │   │   └── delete.ts
│       │   ├── storage/               # Artifact storage
│       │   │   ├── index.ts
│       │   │   └── filesystem.ts
│       │   └── formats/               # Artifact formats
│       │       ├── index.ts
│       │       ├── code.ts
│       │       ├── document.ts
│       │       └── image.ts
│       ├── package.json
│       └── tsconfig.json
│
├── skills/                            # Built-in skills
│   ├── code-review/
│   │   └── skill.yaml
│   ├── test-generation/
│   │   └── skill.yaml
│   ├── refactoring/
│   │   └── skill.yaml
│   ├── documentation/
│   │   └── skill.yaml
│   └── security-audit/
│       └── skill.yaml
│
├── agents/                            # Built-in agents
│   ├── coder/
│   │   └── agent.yaml
│   ├── reviewer/
│   │   └── agent.yaml
│   ├── tester/
│   │   └── agent.yaml
│   └── analyst/
│       └── agent.yaml
│
├── templates/                         # Built-in templates
│   ├── react-component/
│   │   └── template.yaml
│   ├── api-endpoint/
│   │   └── template.yaml
│   └── unit-test/
│       └── template.yaml
│
├── docs/                              # Documentation
│   ├── architecture.md
│   ├── research/
│   └── guides/
│
├── config/                            # Default configurations
│   ├── default.yaml
│   └── providers.yaml
│
├── package.json                       # Root package.json
├── tsconfig.json                      # Root TypeScript config
├── turbo.json                         # Turborepo configuration
├── pnpm-workspace.yaml               # pnpm workspace config
└── README.md
```

### Package Dependencies

```
┌─────────────────────────────────────────────────────────────┐
│                    Package Dependency Graph                  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│                          cli                                 │
│                           │                                  │
│           ┌───────────────┼───────────────┐                 │
│           │               │               │                 │
│           ▼               ▼               ▼                 │
│        agent           skill            spec                │
│           │               │               │                 │
│           └───────┬───────┴───────┬───────┘                 │
│                   │               │                         │
│                   ▼               ▼                         │
│                 mcp            template                      │
│                   │               │                         │
│                   └───────┬───────┘                         │
│                           │                                 │
│                           ▼                                 │
│                       provider                               │
│                           │                                 │
│                           ▼                                 │
│                      artifacts                               │
│                           │                                 │
│                           ▼                                 │
│                         core                                 │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Data Flow

### 5.1 Request Flow

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           Request Flow                                    │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  User Input                                                               │
│      │                                                                    │
│      ▼                                                                    │
│  ┌─────────────────┐                                                     │
│  │  CLI Parser     │  Parse arguments, validate options                  │
│  └────────┬────────┘                                                     │
│           │                                                               │
│           ▼                                                               │
│  ┌─────────────────┐                                                     │
│  │ Command Router  │  Route to appropriate handler                       │
│  └────────┬────────┘                                                     │
│           │                                                               │
│           ├─────────────────┬─────────────────┬─────────────────┐        │
│           ▼                 ▼                 ▼                 ▼        │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────┐   │
│  │ Chat Handler│    │Agent Handler│    │Skill Handler│    │Spec Hdlr│   │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘    └────┬────┘   │
│         │                  │                  │                │         │
│         └──────────────────┴──────────────────┴────────────────┘        │
│                                    │                                      │
│                                    ▼                                      │
│                         ┌─────────────────┐                               │
│                         │ Context Builder │  Build request context       │
│                         └────────┬────────┘                               │
│                                  │                                        │
│                                  ▼                                        │
│                         ┌─────────────────┐                               │
│                         │ Provider Router │  Select LLM provider         │
│                         └────────┬────────┘                               │
│                                  │                                        │
│                                  ▼                                        │
│                         ┌─────────────────┐                               │
│                         │  LLM Provider   │  Execute request             │
│                         └────────┬────────┘                               │
│                                  │                                        │
│                                  ▼                                        │
│                         ┌─────────────────┐                               │
│                         │ Response Handler│  Process response            │
│                         └────────┬────────┘                               │
│                                  │                                        │
│                                  ▼                                        │
│                         ┌─────────────────┐                               │
│                         │ Output Formatter│  Format for display          │
│                         └────────┬────────┘                               │
│                                  │                                        │
│                                  ▼                                        │
│                            User Output                                    │
│                                                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Agent Orchestration Flow

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    Agent Orchestration Flow                               │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  Task Request                                                             │
│      │                                                                    │
│      ▼                                                                    │
│  ┌─────────────────┐                                                     │
│  │ Task Analyzer   │  Decompose task into subtasks                       │
│  └────────┬────────┘                                                     │
│           │                                                               │
│           ▼                                                               │
│  ┌─────────────────┐                                                     │
│  │ Agent Selector  │  Choose appropriate agents                          │
│  └────────┬────────┘                                                     │
│           │                                                               │
│           ├──────────────────────────────────────────────┐               │
│           │                                              │               │
│           ▼                                              ▼               │
│  ┌─────────────────┐                           ┌─────────────────┐      │
│  │ Sequential Exec │                           │ Parallel Exec   │      │
│  │                 │                           │                 │      │
│  │ Agent1 → Agent2 │                           │ Agent1  Agent2 │      │
│  │      → Agent3   │                           │    ↘    ↙      │      │
│  └────────┬────────┘                           │   Aggregator   │      │
│           │                                    └────────┬────────┘      │
│           │                                              │               │
│           └──────────────────────┬───────────────────────┘               │
│                                  │                                        │
│                                  ▼                                        │
│                         ┌─────────────────┐                               │
│                         │ Result Merger   │  Combine agent results       │
│                         └────────┬────────┘                               │
│                                  │                                        │
│                                  ▼                                        │
│                         ┌─────────────────┐                               │
│                         │ Memory Update   │  Store in memory systems     │
│                         └────────┬────────┘                               │
│                                  │                                        │
│                                  ▼                                        │
│                            Final Output                                   │
│                                                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

### 5.3 Provider Failover Flow

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    Provider Failover Flow                                 │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  LLM Request                                                              │
│      │                                                                    │
│      ▼                                                                    │
│  ┌─────────────────┐                                                     │
│  │ Feature Check   │  Determine required features                        │
│  │                 │  - chat, vision, tts, stt, image-gen                │
│  └────────┬────────┘                                                     │
│           │                                                               │
│           ▼                                                               │
│  ┌─────────────────┐                                                     │
│  │ Provider Filter │  Filter by feature support                          │
│  └────────┬────────┘                                                     │
│           │                                                               │
│           ▼                                                               │
│  ┌─────────────────┐                                                     │
│  │ Health Check    │  Verify provider availability                       │
│  └────────┬────────┘                                                     │
│           │                                                               │
│           ▼                                                               │
│  ┌─────────────────┐     ┌─────────────────┐                            │
│  │ Primary Provider│────▶│    Success?     │                            │
│  └─────────────────┘     └────────┬────────┘                            │
│                                    │                                      │
│                           Yes ┌────┴────┐ No                              │
│                               │         │                                 │
│                               ▼         ▼                                 │
│                         ┌─────────┐ ┌─────────────────┐                  │
│                         │ Return  │ │ Backup Provider │                  │
│                         │ Result  │ └────────┬────────┘                  │
│                         └─────────┘          │                            │
│                                              ▼                            │
│                                    ┌─────────────────┐                    │
│                                    │    Success?     │                    │
│                                    └────────┬────────┘                    │
│                                             │                              │
│                                    Yes ┌────┴────┐ No                     │
│                                        │         │                         │
│                                        ▼         ▼                         │
│                                  ┌─────────┐ ┌─────────────┐              │
│                                  │ Return  │ │ Next Backup │              │
│                                  │ Result  │ │   Provider  │              │
│                                  └─────────┘ └─────────────┘              │
│                                                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 6. LLM Provider Abstraction

### 6.1 Provider Interface

```typescript
// packages/provider/src/types/index.ts

interface LLMProvider {
  // Identification
  readonly name: string;
  readonly version: string;
  
  // Capabilities
  readonly features: ProviderFeatures;
  readonly models: ModelInfo[];
  
  // Core Methods
  chat(request: ChatRequest): Promise<ChatResponse>;
  chatStream(request: ChatRequest): AsyncIterable<StreamChunk>;
  
  // Optional Features
  vision?(request: VisionRequest): Promise<VisionResponse>;
  tts?(request: TTSRequest): Promise<AudioResponse>;
  stt?(request: STTRequest): Promise<TranscriptionResponse>;
  imageGeneration?(request: ImageRequest): Promise<ImageResponse>;
  
  // Lifecycle
  initialize(config: ProviderConfig): Promise<void>;
  healthCheck(): Promise<HealthStatus>;
  dispose(): Promise<void>;
}

interface ProviderFeatures {
  chat: boolean;
  streaming: boolean;
  vision: boolean;
  imageGeneration: boolean;
  tts: boolean;
  stt: boolean;
  extendedThinking: boolean;
  toolUse: boolean;
}

interface ChatRequest {
  model: string;
  messages: Message[];
  temperature?: number;
  maxTokens?: number;
  tools?: Tool[];
  stream?: boolean;
}

interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | ContentPart[];
  name?: string;
  toolCallId?: string;
}

interface ContentPart {
  type: 'text' | 'image' | 'audio';
  text?: string;
  imageUrl?: string;
  audioData?: string;
}
```

### 6.2 Provider Implementations

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    Provider Implementation Hierarchy                      │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│                      ┌─────────────────────┐                              │
│                      │   BaseLLMProvider   │                              │
│                      │   (Abstract)        │                              │
│                      └──────────┬──────────┘                              │
│                                 │                                         │
│           ┌─────────────────────┼─────────────────────┐                  │
│           │                     │                     │                  │
│           ▼                     ▼                     ▼                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐          │
│  │OpenAICompatible │  │  CustomProvider │  │  MCPProvider    │          │
│  │   Provider      │  │   (Abstract)    │  │                 │          │
│  └────────┬────────┘  └────────┬────────┘  └─────────────────┘          │
│           │                    │                                          │
│   ┌───────┴───────┐    ┌───────┴───────┐                                 │
│   │               │    │               │                                 │
│   ▼               ▼    ▼               ▼                                 │
│ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐                                 │
│ │minim│ │qwen │ │gpt4 │ │ glm │ │custom│                                 │
│ │ax   │ │     │ │free │ │     │ │      │                                 │
│ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘                                 │
│                                                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

### 6.3 Provider Configuration

```yaml
# config/providers.yaml

providers:
  minimax:
    name: "MiniMax Free API"
    baseUrl: "http://localhost:8000"
    type: "openai-compatible"
    authToken: "${MINIMAX_TOKEN}"
    priority: 1  # Primary provider
    features:
      chat: true
      streaming: true
      vision: true
      imageGeneration: false
      tts: true
      stt: true
    models:
      - id: "hailuo"
        name: "Hailuo Default"
        contextWindow: 128000
      - id: "MiniMax-Text-01"
        name: "MiniMax Text"
        contextWindow: 128000
      - id: "MiniMax-VL-01"
        name: "MiniMax Vision"
        contextWindow: 128000
    healthCheck:
      endpoint: "/health"
      interval: 60000  # 1 minute
      timeout: 5000

  qwen:
    name: "Qwen Free API"
    baseUrl: "http://localhost:8001"
    type: "openai-compatible"
    authToken: "${QWEN_TOKEN}"
    priority: 2  # Backup provider
    features:
      chat: true
      streaming: true
      vision: true
      imageGeneration: true
      tts: false
      stt: false
    models:
      - id: "qwen"
        name: "Qwen Default"
      - id: "qwen-plus"
        name: "Qwen Plus"
      - id: "qwen-max"
        name: "Qwen Max"
    healthCheck:
      endpoint: "/health"
      interval: 60000
      timeout: 5000

  gpt4free:
    name: "GPT4Free TS"
    baseUrl: "http://localhost:3000"
    type: "openai-compatible"
    priority: 3  # Multi-provider fallback
    features:
      chat: true
      streaming: true
      vision: false
      imageGeneration: true
      tts: false
      stt: false
    models:
      - id: "gpt-3.5-turbo"
        name: "GPT-3.5 Turbo"
      - id: "gpt-4"
        name: "GPT-4"
      - id: "claude-2-100k"
        name: "Claude 2 100K"
    sites:  # Provider-specific sites
      - "you"
      - "phind"
      - "forefront"
      - "cursor"
    healthCheck:
      endpoint: "/supports"
      interval: 300000  # 5 minutes
      timeout: 10000

  glm:
    name: "GLM Free API"
    baseUrl: "http://localhost:8002"
    type: "openai-compatible"
    authToken: "${GLM_TOKEN}"
    priority: 4
    features:
      chat: true
      streaming: true
      vision: true
      imageGeneration: true
      tts: false
      stt: false
    models:
      - id: "glm-4-plus"
        name: "GLM-4 Plus"
      - id: "glm-4-zero"
        name: "GLM-4 Zero"
      - id: "glm-4-deepresearch"
        name: "GLM-4 Deep Research"
    healthCheck:
      endpoint: "/token/check"
      interval: 600000  # 10 minutes
      timeout: 5000

# Failover configuration
failover:
  enabled: true
  strategy: "priority"  # priority, round-robin, least-loaded
  maxRetries: 3
  retryDelay: 1000  # 1 second
  backoffMultiplier: 2
  
# Feature mapping for cross-provider compatibility
featureMapping:
  extendedThinking:
    glm: "glm-4-zero"  # Maps to reasoning model
  toolUse:
    all: true  # All providers support via prompt engineering
```

### 6.4 Provider Router

```typescript
// packages/provider/src/router/index.ts

class ProviderRouter {
  private providers: Map<string, LLMProvider>;
  private healthStatus: Map<string, HealthStatus>;
  private config: RouterConfig;

  async route(request: ChatRequest): Promise<ChatResponse> {
    // 1. Determine required features
    const features = this.analyzeFeatures(request);
    
    // 2. Filter providers by feature support
    const candidates = this.filterProviders(features);
    
    // 3. Sort by priority and health
    const sorted = this.sortProviders(candidates);
    
    // 4. Try providers with failover
    for (const provider of sorted) {
      if (await this.isHealthy(provider)) {
        try {
          return await provider.chat(request);
        } catch (error) {
          this.markUnhealthy(provider, error);
          continue;
        }
      }
    }
    
    throw new NoProviderAvailableError(features);
  }

  private analyzeFeatures(request: ChatRequest): FeatureSet {
    return {
      chat: true,
      vision: request.messages.some(m => 
        Array.isArray(m.content) && 
        m.content.some(p => p.type === 'image')
      ),
      tts: false,
      stt: false,
      imageGeneration: false
    };
  }
}
```

---

## 7. Extension Points

### 7.1 Plugin System

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         Plugin System Architecture                        │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  Plugin Types:                                                            │
│  ├── Providers ............. Custom LLM providers                        │
│  ├── Skills ................ Custom skills and workflows                  │
│  ├── Agents ................ Custom agent implementations                 │
│  ├── Tools .................. Custom tools for agents                     │
│  ├── Templates .............. Custom code templates                       │
│  ├── MCP Servers ............ Custom MCP server integrations             │
│  └── Output Formatters ...... Custom output formatting                   │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                      Plugin Lifecycle                             │    │
│  │                                                                   │    │
│  │  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐       │    │
│  │  │ Discover│───▶│  Load   │───▶│ Validate│───▶│Register │       │    │
│  │  └─────────┘    └─────────┘    └─────────┘    └─────────┘       │    │
│  │       │              │              │              │              │    │
│  │       │              │              │              ▼              │    │
│  │       │              │              │       ┌─────────┐          │    │
│  │       │              │              │       │Activate│          │    │
│  │       │              │              │       └─────────┘          │    │
│  │       │              │              │              │              │    │
│  │       ▼              ▼              ▼              ▼              │    │
│  │  ┌─────────────────────────────────────────────────────────┐    │    │
│  │  │                    Plugin Registry                        │    │    │
│  │  └─────────────────────────────────────────────────────────┘    │    │
│  │                                                                   │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                           │
│  Plugin Discovery Locations:                                              │
│  ├── ~/.spazzatura/plugins/ ........ User-installed plugins             │
│  ├── .spazzatura/plugins/ ........... Project-specific plugins          │
│  ├── node_modules/@spazzatura/ ..... NPM packages                       │
│  └── Built-in ...................... Default plugins                    │
│                                                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Plugin Interface

```typescript
// packages/core/src/types/plugin.ts

interface SpazzaturaPlugin {
  // Plugin metadata
  name: string;
  version: string;
  description: string;
  author?: string;
  
  // Dependencies
  dependencies?: {
    spazzatura?: string;  // Version range
    plugins?: string[];   // Required plugins
  };
  
  // Extension points
  providers?: ProviderFactory[];
  skills?: SkillDefinition[];
  agents?: AgentDefinition[];
  tools?: ToolDefinition[];
  templates?: TemplateDefinition[];
  mcpServers?: MCPServerDefinition[];
  formatters?: FormatterFactory[];
  
  // Lifecycle hooks
  onLoad?(context: PluginContext): Promise<void>;
  onActivate?(context: PluginContext): Promise<void>;
  onDeactivate?(): Promise<void>;
  onUnload?(): Promise<void>;
}

interface PluginContext {
  config: ConfigManager;
  logger: Logger;
  state: StateManager;
  registerProvider(factory: ProviderFactory): void;
  registerSkill(definition: SkillDefinition): void;
  registerAgent(definition: AgentDefinition): void;
  registerTool(definition: ToolDefinition): void;
  registerTemplate(definition: TemplateDefinition): void;
  registerMCPServer(definition: MCPServerDefinition): void;
  registerFormatter(factory: FormatterFactory): void;
}
```

### 7.3 Custom Provider Example

```typescript
// Example: Custom provider plugin

import { SpazzaturaPlugin, OpenAICompatibleProvider } from '@spazzatura/core';

const customProviderPlugin: SpazzaturaPlugin = {
  name: 'custom-provider',
  version: '1.0.0',
  description: 'Custom LLM provider integration',
  
  providers: [
    {
      name: 'my-provider',
      create: (config) => new OpenAICompatibleProvider({
        baseUrl: config.baseUrl || 'http://localhost:8080',
        authToken: config.authToken,
        features: {
          chat: true,
          streaming: true,
          vision: false,
          imageGeneration: false,
          tts: false,
          stt: false
        }
      })
    }
  ],
  
  async onLoad(context) {
    context.logger.info('Custom provider plugin loaded');
  }
};

export default customProviderPlugin;
```

### 7.4 Custom Skill Example

```yaml
# skills/custom-review/skill.yaml

name: custom-review
version: 1.0.0
description: Custom code review skill with security focus

dependencies:
  skills:
    - code-review

modes:
  default:
    model: auto  # Use provider router
    temperature: 0.3
    maxTokens: 4096
    
  security:
    model: auto
    temperature: 0.2
    systemPrompt: |
      You are a security-focused code reviewer. Analyze code for:
      - Security vulnerabilities
      - Authentication issues
      - Data validation problems
      - Injection risks
      
  performance:
    model: auto
    temperature: 0.3
    systemPrompt: |
      You are a performance-focused code reviewer. Analyze code for:
      - Algorithmic complexity
      - Memory usage
      - Database query efficiency
      - Caching opportunities

tools:
  - file_read
  - git_diff
  - search_code

outputs:
  format: markdown
  template: |
    ## Code Review: {{filename}}
    
    ### Summary
    {{summary}}
    
    ### Issues Found
    {{#each issues}}
    - **{{severity}}**: {{description}}
      - Location: {{location}}
      - Suggestion: {{suggestion}}
    {{/each}}
    
    ### Recommendations
    {{recommendations}}
```

---

## 8. Configuration Schema

### 8.1 Main Configuration

```yaml
# .spazzatura/config.yaml

# Project identification
project:
  name: "my-project"
  version: "1.0.0"
  description: "Project description"

# LLM Provider settings
providers:
  # Use providers from providers.yaml or override here
  primary: minimax
  fallback:
    - qwen
    - gpt4free
    - glm
    
  # Default model selection
  defaultModel: auto  # auto-select based on task
  
  # Model overrides per task type
  modelOverrides:
    code-generation: qwen-max
    code-review: glm-4-plus
    documentation: hailuo
    testing: gpt-3.5-turbo

# Agent configuration
agents:
  defaultAgent: coder
  
  # Agent-specific settings
  coder:
    model: auto
    temperature: 0.7
    maxTokens: 8192
    tools:
      - file_read
      - file_write
      - execute_command
      - git_operations
      
  reviewer:
    model: auto
    temperature: 0.3
    parallelReview: true
    reviewers:
      - security
      - performance
      - style
      
  tester:
    model: auto
    temperature: 0.5
    frameworks:
      - jest
      - vitest
      - playwright

# Skill configuration
skills:
  # Built-in skills
  enabled:
    - code-review
    - test-generation
    - refactoring
    - documentation
    
  # Custom skill paths
  customPaths:
    - ./skills
    
  # Skill-specific settings
  codeReview:
    reviewers:
      - security
      - performance
      - maintainability
    outputFormat: markdown
    
  testGeneration:
    coverageTarget: 80
    frameworks:
      - jest

# Specification settings
specs:
  format: yaml
  path: ./specs
  validation: strict
  sync:
    enabled: true
    direction: bidirectional
    conflictResolution: prefer-spec

# MCP configuration
mcp:
  servers:
    filesystem:
      command: mcp-filesystem
      args:
        - --root
        - ./
      enabled: true
      
    github:
      command: mcp-github
      env:
        GITHUB_TOKEN: ${GITHUB_TOKEN}
      enabled: true
      
    memory:
      command: mcp-memory
      enabled: true

# Template configuration
templates:
  paths:
    - ./templates
    - ~/.spazzatura/templates
    
  defaults:
    language: typescript
    framework: react
    testFramework: jest

# Output configuration
output:
  format: colorful  # colorful, plain, json
  logLevel: info    # debug, info, warn, error
  progress: true
  streaming: true

# History and state
history:
  enabled: true
  maxSize: 1000
  path: ~/.spazzatura/history
  
state:
  persistence: true
  path: ~/.spazzatura/state

# Undo/redo configuration
undo:
  enabled: true
  maxSize: 50
  autoCheckpoint: true
```

### 8.2 Environment Variables

```bash
# .env

# Provider tokens
MINIMAX_TOKEN=your_minimax_token
QWEN_TOKEN=your_qwen_token
GLM_TOKEN=your_glm_token

# MCP tokens
GITHUB_TOKEN=your_github_token

# Proxy settings (optional)
HTTP_PROXY=http://localhost:7890
HTTPS_PROXY=http://localhost:7890

# Debug settings
SPAZZATURA_DEBUG=false
SPAZZATURA_LOG_LEVEL=info
```

### 8.3 JSON Schema for Configuration

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "project": {
      "type": "object",
      "properties": {
        "name": { "type": "string" },
        "version": { "type": "string" },
        "description": { "type": "string" }
      },
      "required": ["name"]
    },
    "providers": {
      "type": "object",
      "properties": {
        "primary": { "type": "string" },
        "fallback": {
          "type": "array",
          "items": { "type": "string" }
        },
        "defaultModel": { "type": "string" },
        "modelOverrides": {
          "type": "object",
          "additionalProperties": { "type": "string" }
        }
      }
    },
    "agents": {
      "type": "object",
      "additionalProperties": {
        "type": "object",
        "properties": {
          "model": { "type": "string" },
          "temperature": { "type": "number", "minimum": 0, "maximum": 2 },
          "maxTokens": { "type": "integer", "minimum": 1 }
        }
      }
    },
    "skills": {
      "type": "object",
      "properties": {
        "enabled": {
          "type": "array",
          "items": { "type": "string" }
        },
        "customPaths": {
          "type": "array",
          "items": { "type": "string" }
        }
      }
    },
    "mcp": {
      "type": "object",
      "properties": {
        "servers": {
          "type": "object",
          "additionalProperties": {
            "type": "object",
            "properties": {
              "command": { "type": "string" },
              "args": { "type": "array", "items": { "type": "string" } },
              "env": { "type": "object", "additionalProperties": { "type": "string" } },
              "enabled": { "type": "boolean" }
            }
          }
        }
      }
    }
  }
}
```

---

## 9. CLI Command Design

### 9.1 Command Structure

```
spazzatura <command> [subcommand] [options] [arguments]

Commands:
  chat        Interactive chat with AI
  agent       Multi-agent orchestration
  skill       Skill management and execution
  spec        Specification-driven development
  mcp         MCP server management
  template    Template management
  config      Configuration management
  provider    Provider management
  history     Session history management
  undo        Undo last operation
  redo        Redo last undone operation
```

### 9.2 Chat Command

```bash
# Start interactive chat
spazzatura chat

# Single message
spazzatura chat "Explain this code"

# With specific model
spazzatura chat --model qwen-max "Write a function"

# With file context
spazzatura chat --file src/index.ts "Refactor this"

# With provider
spazzatura chat --provider minimax "Hello"

# Streaming (default: true)
spazzatura chat --no-stream "Generate code"

# Temperature
spazzatura chat --temperature 0.5 "Creative writing"

# System prompt
spazzatura chat --system "You are a code reviewer" "Review this"
```

### 9.3 Agent Commands

```bash
# List available agents
spazzatura agent list

# Run single agent
spazzatura agent run coder --task "Implement authentication"

# Run with specific model
spazzatura agent run reviewer --model glm-4-plus

# Multi-agent orchestration
spazzatura agent orchestrate \
  --agents coder,reviewer,tester \
  --task "Build a REST API"

# Parallel execution
spazzatura agent orchestrate \
  --agents reviewer \
  --parallel \
  --task "Review all files"

# Pipeline execution
spazzatura agent pipeline \
  --stages "code,review,test" \
  --task "Implement feature"

# Create custom agent
spazzatura agent create my-agent \
  --template coder \
  --tools file,execute,git

# Install agent from marketplace
spazzatura agent install @community/security-scanner

# Publish agent to marketplace
spazzatura agent publish my-agent
```

### 9.4 Skill Commands

```bash
# List available skills
spazzatura skill list

# Execute a skill
spazzatura skill run code-review --path ./src

# With specific mode
spazzatura skill run code-review --mode security

# Parallel review
spazzatura skill run code-review --parallel

# Create custom skill
spazzatura skill create my-skill \
  --template basic \
  --tools file,search

# Validate skill
spazzatura skill validate my-skill

# Install skill from marketplace
spazzatura skill install @community/api-generator

# Publish skill to marketplace
spazzatura skill publish my-skill

# Show skill info
spazzatura skill info code-review
```

### 9.5 Spec Commands

```bash
# Initialize spec project
spazzatura spec init

# Create new spec
spazzatura spec create feature-auth --template api

# Validate spec
spazzatura spec validate specs/auth.yaml

# Generate code from spec
spazzatura spec generate specs/auth.yaml --output ./src

# Sync spec and code
spazzatura spec sync --direction bidirectional

# Extract spec from code
spazzatura spec extract ./src/auth --output specs/auth.yaml

# Run contract tests
spazzatura spec test specs/auth.yaml

# Watch for changes
spazzatura spec watch --auto-sync
```

### 9.6 MCP Commands

```bash
# List MCP servers
spazzatura mcp list

# Start MCP server
spazzatura mcp start filesystem

# Stop MCP server
spazzatura mcp stop filesystem

# Show server status
spazzatura mcp status

# Add custom server
spazzatura mcp add my-server \
  --command "mcp-my-server" \
  --args "--config ./mcp-config.json"

# Remove server
spazzatura mcp remove my-server

# List available tools from server
spazzatura mcp tools filesystem

# Call MCP tool directly
spazzatura mcp call filesystem read_file --path ./src/index.ts
```

### 9.7 Template Commands

```bash
# List templates
spazzatura template list

# Apply template
spazzatura template apply react-component \
  --output ./src/components \
  --name Button

# With variables
spazzatura template apply api-endpoint \
  --var name=UserAPI \
  --var method=GET \
  --var path=/users

# Create template
spazzatura template create my-template \
  --from ./src/templates/custom

# Validate template
spazzatura template validate my-template

# Install template from marketplace
spazzatura template install @community/nextjs-page
```

### 9.8 Config Commands

```bash
# Show current config
spazzatura config show

# Get specific value
spazzatura config get providers.primary

# Set value
spazzatura config set providers.primary qwen

# Edit config in editor
spazzatura config edit

# Validate config
spazzatura config validate

# Reset to defaults
spazzatura config reset

# Initialize config
spazzatura config init
```

### 9.9 Provider Commands

```bash
# List providers
spazzatura provider list

# Show provider details
spazzatura provider show minimax

# Test provider connection
spazzatura provider test minimax

# Check health
spazzatura provider health

# Add custom provider
spazzatura provider add my-provider \
  --base-url http://localhost:8080 \
  --type openai-compatible

# Set primary provider
spazzatura provider set-primary minimax

# Show available models
spazzatura provider models minimax
```

### 9.10 History and Undo Commands

```bash
# Show history
spazzatura history list

# Show specific session
spazzatura history show <session-id>

# Resume session
spazzatura history resume <session-id>

# Clear history
spazzatura history clear

# Undo last operation
spazzatura undo

# Undo multiple operations
spazzatura undo --count 3

# Redo
spazzatura redo

# Show undo stack
spazzatura undo stack
```

### 9.11 Global Options

```bash
spazzatura [command] [options]

Options:
  --config <path>       Path to config file
  --provider <name>     Override provider
  --model <name>        Override model
  --temperature <n>     Override temperature
  --no-stream           Disable streaming
  --output <format>     Output format (colorful, plain, json)
  --log-level <level>   Log level (debug, info, warn, error)
  --debug               Enable debug mode
  --version             Show version
  --help                Show help
```

---

## 10. Technology Stack

### 10.1 Core Technologies

| Category | Technology | Purpose |
|----------|------------|---------|
| **Language** | TypeScript 5.x | Type-safe development |
| **Runtime** | Node.js 20+ | JavaScript runtime |
| **Package Manager** | pnpm | Fast, disk-efficient package management |
| **Build System** | Turborepo | Monorepo build orchestration |
| **Bundler** | tsup | TypeScript bundling |

### 10.2 Dependencies

```json
{
  "dependencies": {
    // CLI Framework
    "commander": "^12.0.0",
    "inquirer": "^9.2.0",
    "chalk": "^5.3.0",
    "ora": "^8.0.0",
    "cli-highlight": "^2.2.0",
    
    // LLM Integration
    "openai": "^4.0.0",
    
    // MCP Protocol
    "@modelcontextprotocol/sdk": "^1.0.0",
    
    // File Operations
    "fs-extra": "^11.2.0",
    "chokidar": "^3.6.0",
    "glob": "^10.3.0",
    
    // Parsing
    "yaml": "^2.3.0",
    "marked": "^12.0.0",
    "json-schema-to-ts": "^2.9.0",
    
    // Templates
    "handlebars": "^4.7.0",
    "mustache": "^4.2.0",
    
    // State Management
    "conf": "^12.0.0",
    "lowdb": "^7.0.0",
    
    // Utilities
    "zod": "^3.22.0",
    "date-fns": "^3.0.0",
    "p-queue": "^8.0.0",
    "p-retry": "^6.0.0",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    // Testing
    "vitest": "^1.0.0",
    "@vitest/coverage-v8": "^1.0.0",
    
    // Type Checking
    "typescript": "^5.3.0",
    "@types/node": "^20.0.0",
    
    // Linting
    "eslint": "^8.56.0",
    "@typescript-eslint/eslint-plugin": "^6.0.0",
    "prettier": "^3.2.0",
    
    // Build
    "tsup": "^8.0.0",
    "turbo": "^1.12.0"
  }
}
```

### 10.3 Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Monorepo Structure** | Turborepo + pnpm workspaces | Enables modular development, shared types, independent versioning |
| **TypeScript** | Strict mode | Type safety for complex agent/skill interactions |
| **OpenAI-Compatible API** | Primary interface | Maximum provider compatibility |
| **YAML Configuration** | Primary format | Human-readable, supports comments |
| **Plugin Architecture** | Dynamic loading | Extensibility without core changes |
| **Streaming First** | SSE/WebSocket | Real-time feedback for long operations |
| **Stateless Core** | Functional design | Easier testing, predictable behavior |

---

## 11. Implementation Phases

### Phase 1: Foundation

**Goal:** Establish core infrastructure and basic CLI

**Deliverables:**
- [ ] Project setup with Turborepo monorepo
- [ ] Core package with types and utilities
- [ ] CLI package with basic command structure
- [ ] Configuration management system
- [ ] Logging system
- [ ] Basic chat command with single provider

**Dependencies:** None

**Testing:** Unit tests for core utilities, integration tests for CLI

---

### Phase 2: Provider Layer

**Goal:** Multi-provider support with failover

**Deliverables:**
- [ ] Provider abstraction interfaces
- [ ] OpenAI-compatible base provider
- [ ] MiniMax provider implementation
- [ ] Qwen provider implementation
- [ ] GPT4Free provider implementation
- [ ] GLM provider implementation
- [ ] Provider router with failover
- [ ] Health check system
- [ ] Provider CLI commands

**Dependencies:** Phase 1

**Testing:** Mock provider tests, failover scenario tests

---

### Phase 3: Agent System

**Goal:** Multi-agent orchestration

**Deliverables:**
- [ ] Agent registry and loader
- [ ] Agent definition schema
- [ ] Sequential orchestration
- [ ] Parallel orchestration
- [ ] Pipeline orchestration
- [ ] Hierarchical orchestration
- [ ] Built-in agents (coder, reviewer, tester, analyst)
- [ ] Memory systems (conversation, working)
- [ ] Tool integration framework
- [ ] Agent CLI commands

**Dependencies:** Phase 2

**Testing:** Agent behavior tests, orchestration tests

---

### Phase 4: Skill System

**Goal:** Modular skill execution

**Deliverables:**
- [ ] Skill registry and loader
- [ ] Skill definition schema
- [ ] Skill execution engine
- [ ] Mode management
- [ ] Parallel review system
- [ ] Built-in skills (code-review, test-generation, etc.)
- [ ] Skill composition
- [ ] Skill CLI commands

**Dependencies:** Phase 2

**Testing:** Skill execution tests, composition tests

---

### Phase 5: Specification Engine

**Goal:** Spec-driven development

**Deliverables:**
- [ ] YAML/Markdown spec parser
- [ ] Spec validation framework
- [ ] Code generator from specs
- [ ] Spec extraction from code
- [ ] Bidirectional sync
- [ ] Contract testing
- [ ] Spec CLI commands

**Dependencies:** Phase 2

**Testing:** Parser tests, generation tests, sync tests

---

### Phase 6: MCP Integration

**Goal:** Model Context Protocol support

**Deliverables:**
- [ ] MCP client implementation
- [ ] Server discovery and lifecycle
- [ ] Tool registration
- [ ] Resource access
- [ ] Prompt templates
- [ ] Built-in server integrations
- [ ] MCP CLI commands

**Dependencies:** Phase 2

**Testing:** Protocol tests, server integration tests

---

### Phase 7: Template Engine

**Goal:** Code generation templates

**Deliverables:**
- [ ] Template parser
- [ ] Variable system
- [ ] Built-in templates
- [ ] Template CLI commands
- [ ] Template marketplace integration

**Dependencies:** Phase 2

**Testing:** Template rendering tests

---

### Phase 8: Advanced Features

**Goal:** Polish and advanced capabilities

**Deliverables:**
- [ ] Undo/redo system
- [ ] Session persistence
- [ ] History management
- [ ] Interactive REPL mode
- [ ] Tab completion
- [ ] Progress indicators
- [ ] Artifact management
- [ ] Extended thinking support
- [ ] Voice features (TTS/STT)

**Dependencies:** Phases 1-7

**Testing:** Feature tests, UX tests

---

### Phase 9: Marketplace and Ecosystem

**Goal:** Community features

**Deliverables:**
- [ ] Agent marketplace client
- [ ] Skill marketplace client
- [ ] Template marketplace client
- [ ] Publishing workflow
- [ ] Search and discovery
- [ ] Version management

**Dependencies:** Phases 3, 4, 7

**Testing:** Marketplace integration tests

---

### Phase 10: Documentation and Release

**Goal:** Production readiness

**Deliverables:**
- [ ] User documentation
- [ ] API documentation
- [ ] Plugin development guide
- [ ] Contribution guidelines
- [ ] Release automation
- [ ] NPM package publishing

**Dependencies:** Phases 1-9

**Testing:** Documentation accuracy tests

---

## Appendix A: Feature Matrix

| Feature | Codebuff | Oh-My-OpenAgent | Claude Code | Superpowers | OpenSpec | Spazzatura |
|---------|----------|-----------------|-------------|-------------|----------|------------|
| **Core** |
| CLI Interface | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Streaming | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Multi-model | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |
| **Agents** |
| Single Agent | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Multi-Agent | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ |
| Orchestration | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ |
| Memory Systems | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ |
| **Skills** |
| Skill System | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ |
| Parallel Review | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ |
| Mode Switching | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ |
| **Specs** |
| Spec-Driven | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Bidirectional Sync | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Contract Testing | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Integration** |
| MCP Support | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ |
| Tool Integration | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| Template System | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Features** |
| Undo/Redo | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Extended Thinking | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ |
| TTS/STT | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Vision | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ |
| Image Generation | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Ecosystem** |
| Marketplace | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ |
| Plugin System | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ |

---

## Appendix B: Glossary

| Term | Definition |
|------|------------|
| **Agent** | An autonomous AI entity that can perform tasks using tools and memory |
| **Skill** | A reusable, composable unit of AI capability with defined inputs and outputs |
| **Spec** | A structured specification that defines expected behavior for AI implementation |
| **MCP** | Model Context Protocol - a standard for connecting AI models to external tools |
| **Provider** | An LLM service that can generate text and other outputs |
| **Orchestration** | The coordination of multiple agents to accomplish complex tasks |
| **Template** | A reusable pattern for generating code or other artifacts |
| **Artifact** | A generated output such as code, documentation, or images |

---

*Architecture Document Version 1.0.0 - March 21, 2026*

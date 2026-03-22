# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial project structure
- Monorepo setup with pnpm workspaces
- Base TypeScript configuration
- Package scaffolding for all core modules:
  - `@spazzatura/cli` - CLI entry point
  - `@spazzatura/core` - Shared types and utilities
  - `@spazzatura/provider` - LLM abstraction layer
  - `@spazzatura/agent` - Multi-agent orchestration
  - `@spazzatura/skill` - Skills system
  - `@spazzatura/spec` - Specification engine
  - `@spazzatura/mcp` - MCP integration
  - `@spazzatura/template` - Template engine
  - `@spazzatura/artifacts` - Output management

## [0.0.1] - 2026-03-21

### Added
- Project initialization
- Architecture documentation
- Research documentation for CLI tools and LLM providers

[unreleased]: https://github.com/spazzatura/spazzatura/compare/v0.0.1...HEAD
[0.0.1]: https://github.com/spazzatura/spazzatura/releases/tag/v0.0.1

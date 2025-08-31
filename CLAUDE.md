# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Compoder is an AI-powered component code generation engine built with Next.js that creates customizable AI-powered component code generators for various frontend tech stacks. It supports multiple AI models and component libraries (React, Vue, Mui, Antd, Element-Plus, Tailwind CSS, Shadcn UI).

## Core Architecture

### Directory Structure

- `app/` - Next.js 13+ app router structure
  - `api/` - API routes for AI core, authentication, codegen, and component operations
  - `main/` - Main application pages and layouts
  - `commons/` - Shared components and providers
  - `services/` - Frontend service layer for API communication
- `components/` - Reusable React components
  - `biz/` - Business-specific components
  - `ui/` - Base UI components (shadcn/ui based)
- `lib/` - Core utilities and configurations
  - `db/` - Database schemas, mutations, and selectors (MongoDB with Mongoose)
  - `auth/` - NextAuth.js authentication logic
  - `xml-message-parser/` - AI response streaming and parsing utilities
  - `config/` - AI provider configurations
- `artifacts/` - Multiple rendering sandbox environments for different UI libraries
  - `antd-renderer/` - Ant Design sandbox
  - `shadcn-ui-renderer/` - Shadcn UI sandbox
  - `material-ui-renderer/` - Material UI sandbox
  - `element-ui-plus-renderer/` - Element Plus sandbox
  - `page-ui-renderer/` - Page UI components sandbox

### Key Technical Patterns

**AI Integration**: Uses Vercel AI SDK with support for multiple providers (OpenAI, Anthropic, DeepSeek, Ollama, OpenRouter). AI model configurations are stored in `data/config.json`.

**Component Generation Workflow**:

1. Design phase (`app/api/ai-core/steps/design-component/`)
2. Code generation (`app/api/ai-core/steps/generate-component/`)
3. Storage (`app/api/ai-core/steps/store-component/`)

**Database Layer**: MongoDB with Mongoose ODM. Schemas defined in `lib/db/*/schema.ts` with corresponding mutations and selectors.

**Authentication**: NextAuth.js with GitHub provider support.

**Streaming Architecture**: Custom XML message parser for AI response streaming (`lib/xml-message-parser/`).

## Common Development Commands

### Environment Setup

```bash
# Copy and configure environment files
cp .env.template .env
cp data/config.template.json data/config.json
cp data/codegens.template.json data/codegens.json

# Start MongoDB via Docker
cp docker-compose.template.yml docker-compose.yml
docker compose up -d

# Migrate codegen configurations
pnpm migrate-codegen
```

### Development

```bash
pnpm dev                    # Start main application (localhost:3000)
pnpm storybook             # Start Storybook (localhost:6006)
```

### Artifact Renderers (Start as needed)

```bash
cd artifacts/antd-renderer && pnpm dev          # Ant Design sandbox
cd artifacts/shadcn-ui-renderer && pnpm dev     # Shadcn UI sandbox
cd artifacts/material-ui-renderer && pnpm dev   # Material UI sandbox
cd artifacts/element-ui-plus-renderer && pnpm dev # Element Plus sandbox
cd artifacts/page-ui-renderer && pnpm dev       # Page UI sandbox
```

### Testing & Quality

```bash
pnpm test                  # Run Jest unit tests
pnpm test:storybook        # Run Storybook tests with Playwright
pnpm lint                  # ESLint + TypeScript check (tsc --noEmit)
pnpm format                # Prettier formatting
pnpm format:check          # Check Prettier formatting
```

### Build & Deploy

```bash
pnpm build                 # Production build
pnpm build:docker          # Build Docker image
pnpm build:artifacts-docker # Build artifact renderers Docker images
pnpm build-storybook       # Build Storybook static files
```

## Important Configuration Files

- `data/config.json` - AI provider configurations (models, API keys, base URLs)
- `data/codegens.json` - Codegen template configurations
- `components.json` - shadcn/ui component configuration
- `.env` - Environment variables (MongoDB URI, NextAuth secrets, GitHub OAuth)

## Component Development Standards

### Business Components (components/biz/)

Follow the 4-file structure defined in `.cursor/rules/generate-biz-component.mdc`:

1. `index.ts` - Component exports
2. `interface.ts` - TypeScript prop interfaces
3. `[ComponentName].stories.tsx` - Storybook documentation
4. `[ComponentName].tsx` - Component implementation

### Component Requirements

- Use shadcn/ui components exclusively
- Follow data decoupling: no direct API calls in components
- Pass data via props with callbacks for actions
- Use Tailwind CSS for styling
- Include comprehensive Storybook stories

### TypeScript Standards

- **CRITICAL**: No `any` types allowed - use proper TypeScript typing
- Define interfaces in separate `interface.ts` files
- Export types alongside components

## Testing Strategy

- **Unit Tests**: Jest with ts-jest preset
- **Component Tests**: Storybook with test runner
- **E2E Tests**: Playwright for Storybook test scenarios
- Test files: `**/__tests__/**/*.[jt]s?(x)` or `**/?(*.)+(spec|test).[tj]s?(x)`

## Cursor AI Rules

The project includes specialized Cursor rules for code generation:

- `generate:biz-component` - Generate business components
- `generate:page-integration` - Generate page integrations
- `generate:services` - Generate service layer code
- `generate:sql-api` - Generate SQL API endpoints
- `refactor:bizcomponent` - Refactor business components

## Database Operations

**Migration**: Run `pnpm migrate-codegen` after updating codegen configurations.

**Schema Organization**: Each domain has separate schema, mutations, and selectors files in `lib/db/[domain]/`.

- yanz57213@gmail.com 测试帐号, 密码: a12345678

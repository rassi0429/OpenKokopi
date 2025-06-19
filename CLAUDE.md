# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
OpenKokopi is a Heroku-like Platform-as-a-Service (PaaS) built on Kubernetes. It provides a web control panel for easily deploying Node.js applications without requiring CI/CD image building. The primary use case is deploying Discord bots.

## Development Commands

### Installation and Development
```bash
npm i                    # Install all dependencies (uses npm workspaces)
npm run dev             # Run both backend and frontend in development mode
npm run build           # Build both backend and frontend
npm run start           # Start both services in production mode
```

### Individual Service Commands
```bash
# Backend (Express API)
npm run dev:backend     # Build and start backend
npm run build:backend   # TypeScript compilation
npm run start:backend   # Start compiled backend

# Frontend (Next.js Panel)
npm run dev:panel       # Start Next.js dev server on port 3001
npm run build:panel     # Build Next.js application
npm run start:panel     # Start Next.js production server
npm run lint:panel      # Run ESLint on frontend code
```

## Architecture

### Workspace Structure
The project uses npm workspaces with two main components:
- `workspaces/backend/` - Express.js API server that manages Kubernetes resources
- `workspaces/panel/` - Next.js web UI for the control panel

### Backend API Architecture
The backend provides RESTful endpoints for Kubernetes operations:
- **Entry point**: `workspaces/backend/src/main.ts` - Sets up Express with basic auth middleware
- **API routes**: `workspaces/backend/src/api/index.ts` - Defines all Kubernetes operation endpoints
- **K8s manifests**: `workspaces/backend/src/lib/k8s/` - Contains functions to generate Kubernetes resources
- **Authentication**: Uses hardcoded basic auth (admin:pass) - should be configured via environment variables in production

### Frontend Architecture
Next.js application using App Router:
- **Pages**: Located in `workspaces/panel/pages/`
- **Components**: Reusable UI components in `workspaces/panel/Components/`
- **Styling**: Uses Ant Design components with Tailwind CSS utilities
- **API Integration**: Communicates with backend via `/api` proxy

### Deployment Flow
1. User provides Git repository URL, hostname, and environment variables
2. Backend creates a new Kubernetes namespace with label `app=kokopi`
3. Deploys a Deployment that:
   - Clones the Git repository
   - Runs `npm install`
   - Starts the Node.js application on port 3000
4. Creates a Service and Ingress for external access via the specified hostname

### Key Technical Details
- Uses Kubernetes client-node library for K8s operations
- Assumes all deployed apps run on port 3000
- No persistent volume support currently
- Environment variables are stored in namespace annotations (marked as "not_implemented")
- Uses nginx-ingress for routing traffic to deployed applications

## Important Notes
- The platform itself requires nginx-ingress to be installed in the cluster
- Node.js version is pinned to 22.13.1 via Volta
- TypeScript is configured with strict mode in both workspaces
- No test framework is currently set up
- The backend uses ES modules (type: "module" in package.json)
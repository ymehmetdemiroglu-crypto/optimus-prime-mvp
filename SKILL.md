---
name: grok-admaster
description: AI-powered "War Room" dashboard for Amazon sellers that automates PPC, SEO, and DSP strategies. Full-stack application with FastAPI backend and React frontend featuring real-time KPIs, campaign management, and Grok AI chat assistant.
---

# Grok AdMaster

Build an AI-powered "War Room" dashboard for Amazon sellers with automated PPC, SEO, and DSP strategy management.

## What This Skill Does

This skill provides a complete full-stack application template for Amazon advertising optimization:

- **Backend (Python/FastAPI)**: RESTful API with mock data simulation, AI strategy recommendations, and campaign management endpoints
- **Frontend (React/TypeScript)**: Cyber-professional dark mode UI with real-time dashboards, interactive charts, and AI chat interface
- **Features**: War Room Dashboard, Campaign Manager with AI strategy toggles, Grok AI Chat assistant

## When to Use This Skill

Use this skill when:
- Building Amazon seller tools or PPC management platforms
- Creating advertising analytics dashboards
- Implementing AI-powered campaign optimization systems
- Developing e-commerce analytics applications
- Learning full-stack development with FastAPI + React

## Tech Stack

**Backend:**
- FastAPI (Python 3.11+)
- Pydantic for data validation
- Uvicorn ASGI server
- Mock AI simulation services

**Frontend:**
- React 18 + TypeScript
- Tailwind CSS (Dark Mode)
- Recharts for data visualization
- React Router for navigation
- Vite for build tooling

## Quick Start

### Backend Setup
1. Create a `.env` file based on `.env.example`:
   ```bash
   cd skills/grok-admaster/server
   cp .env.example .env
   ```
2. Install dependencies and run:
   ```bash
   python -m venv venv
   venv\Scripts\activate  # Windows
   pip install -r requirements.txt
   uvicorn app.main:app --reload
   ```

### Frontend Setup
1. Create a `.env` file based on `.env.example` (optional, defaults to /api):
   ```bash
   cd skills/grok-admaster/client
   cp .env.example .env
   ```
2. Install and run:
   ```bash
   npm install
   npm run dev
   ```

### Access Points
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

## Project Structure

```
grok-admaster/
├── SKILL.md              # This file
├── README.md             # User-facing documentation
├── server/               # Python Backend
│   ├── requirements.txt
│   └── app/
│       ├── main.py           # FastAPI app
│       ├── api/
│       │   └── endpoints.py  # Route handlers
│       ├── models/
│       │   └── schemas.py    # Pydantic models
│       └── services/
│           └── ai_simulation.py  # AI logic
└── client/               # React Frontend
    ├── package.json
    ├── vite.config.ts
    └── src/
        ├── App.tsx           # Main app
        ├── api/              # API client
        ├── components/       # UI components
        ├── pages/            # Route pages
        └── types/            # TypeScript interfaces
```

## Key Features

### War Room Dashboard
- Real-time KPIs (ACOS, ROAS, CTR, CVR)
- Sales velocity charts
- AI action feed with recommendations
- Campaign performance metrics

### Campaign Manager
- AI strategy toggles (Auto Pilot, Aggressive, Profit Guard)
- Campaign status monitoring
- Budget and performance tracking
- Strategy-based optimization

### Grok AI Chat
- Intelligent assistant for optimization
- Natural language queries
- Contextual recommendations
- Interactive conversation interface

## Design Philosophy

The UI follows a **cyber-professional** aesthetic:
- Deep blacks (#0a0a0a, #111111)
- Neon accents (cyan, electric blue, lime green)
- Subtle glow effects and glassmorphism
- High-contrast, data-dense layouts
- Professional yet futuristic feel

## Customization

This is a template/starter kit. Customize by:
- Replacing mock data with real Amazon Advertising API
- Integrating actual AI/ML models for recommendations
- Adding authentication and user management
- Implementing database persistence
- Extending with additional features (SEO tools, DSP analytics)

## Use Cases

- **Amazon Seller Tools**: PPC management platforms
- **Agency Dashboards**: Client campaign monitoring
- **Learning Projects**: Full-stack development practice
- **Prototypes**: Quick MVP for advertising tech startups
- **Portfolio Projects**: Showcase full-stack skills

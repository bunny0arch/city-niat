# MissionControl AI — Event Operations Workspace

An AI-powered event-planning execution workspace designed for operations teams, event producers, and logistics managers.

---

## 🛠 Tech Stack

- **Frontend**: React 19, Vite 8, TypeScript
- **Workflow Canvas**: `@xyflow/react` (interactive milestone DAG)
- **Icons**: `lucide-react`
- **Backend**: Python 3.12+, FastAPI, Pydantic v2, Uvicorn
- **Database**: SQLite (local development)
- **AI Integration (Ready)**: Google `google-genai` SDK with Gemma 4 / Gemini models

---

## 📂 Project Architecture

```
missioncontrol-ai/
├── .env.example             # Master environment variable template (placeholders only)
├── .gitignore               # Ignores node_modules, .venv, caches, databases, and secrets
├── README.md                # Project setup and documentation
├── backend/
│   ├── .env.example         # Backend specific environment variables
│   ├── requirements.txt     # Backend Python dependencies
│   ├── run.py               # Local server startup script
│   ├── test_api.py          # Automated integration test suite
│   └── app/
│       ├── __init__.py
│       ├── config.py        # Centralized settings & CORS origins
│       ├── main.py          # FastAPI application entrypoint & lifespan
│       ├── db/
│       │   └── database.py  # SQLite schema, WAL mode, seed workflow
│       ├── schemas/
│       │   └── mission.py   # Pydantic models for missions, tasks, and edges
│       ├── services/
│       │   └── graph_service.py # DAG cycle detection & topological validation
│       └── api/
│           ├── __init__.py
│           ├── health.py    # Health check endpoint (GET /api/health)
│           └── missions.py  # Full CRUD for missions, tasks, and dependency edges
└── frontend/
    ├── .env.example         # Frontend specific environment variables
    ├── package.json         # Scripts and dependencies (@xyflow/react, lucide-react)
    ├── vite.config.ts       # Vite configuration with API dev proxy
    ├── tsconfig.json
    └── src/
        ├── App.tsx          # Application shell & workspace coordinator
        ├── App.css          # Operational workspace dark design
        ├── index.css        # Design tokens, typography & CSS reset
        ├── main.tsx         # React root
        ├── api/
        │   └── client.ts    # Typed API client with latency timing
        ├── components/
        │   ├── CreateMissionModal.tsx # New mission creation modal
        │   ├── CustomEventNode.tsx    # Operational XYFlow node component
        │   ├── Header.tsx             # Header with mission switcher & health
        │   ├── InspectorPanel.tsx     # Task checklist, editing & mission metrics
        │   ├── Sidebar.tsx            # Event metrics & workspace navigation
        │   ├── StatusBar.tsx          # Live infrastructure status bar
        │   ├── TaskModal.tsx          # Create / Edit task node dialog
        │   └── WorkflowCanvas.tsx     # Interactive @xyflow/react DAG with cycle rejection
        └── types/
            └── index.ts     # TypeScript schemas for event execution
```

---

## 🚀 Quickstart Guide (Windows PowerShell)

Both frontend and backend are independently runnable in separate PowerShell terminals.

### 1. Backend Setup & Run

Open a Windows PowerShell terminal in the `backend` folder:

```powershell
# Navigate to the backend directory
cd backend

# Create virtual environment with Python 3.12 (or default Python)
py -3.12 -m venv .venv

# Activate the virtual environment
.\.venv\Scripts\Activate.ps1

# Install required dependencies
pip install -r requirements.txt

# Start the FastAPI development server
python run.py
```

- **Backend API URL**: `http://localhost:8000`
- **Interactive OpenAPI Docs**: `http://localhost:8000/docs`
- **Health Endpoint**: `http://localhost:8000/api/health`

### 2. Frontend Setup & Run

Open a second Windows PowerShell terminal in the `frontend` folder:

```powershell
# Navigate to the frontend directory
cd frontend

# Install dependencies
npm install

# Start the Vite development server
npm run dev
```

- **Frontend App URL**: `http://localhost:5173`
- The frontend dev server proxies `/api` calls directly to `http://localhost:8000`.

---

## 🧪 Quality Checks Verified

- ✅ **Backend Dependencies**: Installed successfully in Python 3.12 virtual environment.
- ✅ **Backend Health Endpoint**: `GET /api/health` returns `200 OK` with JSON `{ "status": "ok", "service": "missioncontrol-backend", ... }`.
- ✅ **Backend Integration Tests**: All 12 automated integration tests passed in `test_api.py` covering mission creation, task CRUD, position persistence, cycle rejection, self-loop rejection, and duplicate edge detection.
- ✅ **Frontend Dependencies**: `@xyflow/react` and `lucide-react` installed cleanly with 0 vulnerabilities.
- ✅ **Frontend Lint**: `oxlint` passes with **0 errors and 0 warnings**.
- ✅ **Frontend Production Build**: `npm run build` succeeds with optimized bundle generation (built in ~837ms).
- ✅ **Database & Persistence**: SQLite configured with foreign keys and WAL mode; zero mock data masquerading as persistence.
- ✅ **Security**: Zero real API keys present; `.gitignore` rules active for `.env`, virtualenvs, SQLite DBs, and build artifacts.

## Demo access

The browser demo seeds two local accounts on the sign-in screen. Selecting either account fills the form and opens the sample `Global TechSummit 2026` workflow with its dependency-aware task graph.

| Name | Email | Password |
| --- | --- | --- |
| Alex Morgan | `alex@cityniat.demo` | `CityNiat2026!` |
| Maya Chen | `maya@cityniat.demo` | `MissionFlow2026!` |

New accounts require a full name. The submitted name is stored with the local account and displayed in the dashboard profile menu. Opening the profile no longer logs out; sign-out is an explicit action inside the profile menu.

## AI graph commands

Interactive graph commands use structured JSON output through `GEMINI_FAST_MODEL` (`gemini-3.5-flash-lite` by default). New tasks are normalized from natural language, explicit priority and ownership are preserved, and the backend assigns each created task a free grid position so nodes do not overlap. The slower Gemma model is not retried for interactive edits, so a provider failure returns promptly instead of creating a long wait.

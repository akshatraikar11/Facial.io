# Facial.io — SaaS Rebuild Blueprint

> This document is the single source of truth for the Facial.io SaaS rebuild.
> If development pauses at any point, start here to understand what is built,
> what is in progress, and what comes next.

---

## What Is Facial.io?

Facial.io is a **multi-tenant face recognition attendance SaaS platform**. Any
organization — a company, school, co-working space, or event venue — can sign
up, register their employees or members with a face scan, and run a kiosk that
automatically marks attendance when a face is recognized.

It is not just an attendance tracker. It combines real-time check-in feeds,
AI-powered analytics, anomaly detection, and subscription billing into a
complete product that any agency or organization can use out of the box.

---

## What Makes It Unique

| Feature | Why It Stands Out |
|---|---|
| **Multi-tenant by design** | Each organization's data is fully isolated. One deployment serves unlimited organizations. |
| **Server-side vector face matching** | Face descriptors are stored in Pinecone as vectors. Matching happens on the server via similarity search — not in the browser. Scales to thousands of employees per org. |
| **RAG attendance assistant** | Admins can ask natural language questions: "Who was absent more than 3 times this month?" LangChain.js retrieves relevant attendance records and Gemini constructs the answer. |
| **Real-time kiosk feed** | Socket.io pushes every new check-in live to the dashboard the moment it happens — no polling, no refresh. |
| **Anomaly detection** | A nightly cron job flags employees with unusual absence patterns and emails the admin via Resend. |
| **Stripe billing built in** | Free / Pro / Enterprise tiers with real feature gates. The billing portal is part of the product. |
| **Zero-cost tech choices** | Every service used has a free tier that covers development and demo use completely. |

---

## Who Uses It

- **Org Admins** — sign up, create an organization, register employees, view the dashboard, manage billing, chat with the AI assistant.
- **Employees / Members** — get registered with a face scan once. After that, they walk up to the kiosk and attendance is marked automatically.
- **Kiosk Operator** — anyone running the kiosk screen (a tablet or monitor at an entrance). No login required for the kiosk itself.

---

## Full Tech Stack

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| React | 19 | UI framework |
| Vite | 7 | Build tool and dev server |
| TypeScript | 5 | Type safety |
| Tailwind CSS | 4 | Utility-first styling |
| Framer Motion | 12 | Animations and transitions |
| Recharts | latest | Analytics charts on the dashboard |
| Socket.io Client | latest | Real-time attendance feed |
| TanStack Query | v5 | Server state management, caching |
| Axios | latest | HTTP client with Clerk JWT injection |
| face-api.js | 0.22 | Client-side face detection and descriptor extraction |
| Lucide React | latest | Icons |
| Clerk (React SDK) | latest | Auth UI components and session management |

### Backend
| Technology | Version | Purpose |
|---|---|---|
| NestJS | 10 | Backend framework — modules, DI, Guards, Interceptors |
| TypeScript | 5 | Type safety |
| MongoDB | Atlas | Primary database |
| Mongoose | 8 | ODM for MongoDB |
| Clerk (Node SDK) | latest | JWT verification, org management, webhooks |
| Socket.io | latest | WebSocket gateway for real-time events |
| Pinecone | latest | Vector database for face descriptor storage and similarity search |
| LangChain.js | latest | RAG pipeline orchestration |
| Google Gemini API | latest | LLM for the analytics assistant (free tier, no card required) |
| Stripe | latest | Subscription billing — test mode during development |
| Resend | latest | Transactional email — late alerts, absence summaries |
| Zod | 3 | DTO validation |
| class-validator | latest | NestJS-native validation decorators |
| @nestjs/schedule | latest | Cron jobs for anomaly detection |
| Swagger (OpenAPI) | latest | Auto-generated API docs at /api/docs |

### Infrastructure
| Technology | Purpose |
|---|---|
| Docker | Containerize frontend and backend for consistent environments |
| Docker Compose | Spin up all services locally with one command |
| Kubernetes | Deployment manifests (k8s/) for production-grade orchestration |
| Vercel | Frontend deployment — free tier |
| Render | Backend deployment — free tier |
| MongoDB Atlas | Cloud database — free 512MB shared cluster |

### Testing
| Technology | Purpose |
|---|---|
| Vitest | Unit tests for frontend utilities and hooks |
| Supertest | Integration tests for NestJS API endpoints |

---

## Data Models

### Organization
```
orgId        string   (from Clerk — this IS the org identifier)
name         string
plan         enum: free | pro | enterprise
stripeCustomerId  string
createdAt    Date
```

### Employee
```
_id          ObjectId
orgId        string   ← ALL queries scope by this
name         string
email        string
clerkUserId  string   (optional — if the employee also has a Clerk login)
pineconeId   string   (vector ID in Pinecone)
createdAt    Date
```

### AttendanceLog
```
_id          ObjectId
orgId        string   ← ALL queries scope by this
employeeId   ObjectId (ref: Employee)
name         string   (denormalized for fast reads)
date         string   YYYY-MM-DD
time         string   HH:MM
status       enum: present | late | absent
timestamp    Date
```

### SubscriptionPlan (feature gates)
```
free        → max 10 employees, no AI assistant, no anomaly alerts
pro         → max 100 employees, AI assistant, anomaly alerts, advanced export
enterprise  → unlimited, custom webhooks, priority support
```

---

## Architecture: Feature-Sliced Modular

The backend uses NestJS's module system. Each feature domain is a self-contained
module with its own controller, service, DTOs, and schema. This replaces the
flat MVC structure from the prototype.

The frontend mirrors this — each feature lives in `src/modules/<feature>/` with
its own components and hooks. Shared UI components stay in `src/shared/`.

---

## Folder Structure

```
facial.io/
├── BLUEPRINT.md                     ← YOU ARE HERE
│
├── client/                          # React 19 + Vite frontend
│   ├── public/
│   │   └── models/                  # face-api.js weights (unchanged)
│   └── src/
│       ├── app/                     # App bootstrap, router
│       ├── modules/
│       │   ├── auth/                # Login, signup, session hooks
│       │   ├── dashboard/           # Stats, charts, activity feed
│       │   ├── employees/           # Registration, face enrollment, CRUD
│       │   ├── attendance/          # Kiosk, real-time feed
│       │   ├── billing/             # Pricing page, billing portal
│       │   └── ai/                  # Chat assistant UI
│       ├── shared/
│       │   ├── components/ui/       # Button, Card, Badge, Toast
│       │   ├── hooks/               # useSocket, useToast
│       │   └── utils/               # faceApi.ts, export.ts, validation.ts
│       ├── services/
│       │   ├── api.ts               # Axios + Clerk JWT
│       │   ├── socket.ts            # Socket.io client
│       │   └── queryClient.ts       # TanStack Query setup
│       └── types/index.ts
│
├── server/                          # NestJS backend
│   └── src/
│       ├── app.module.ts
│       ├── main.ts
│       ├── modules/
│       │   ├── auth/                # Clerk JWT guard, roles, decorators
│       │   ├── organizations/       # Org creation, Clerk webhooks
│       │   ├── employees/           # CRUD + Pinecone upsert on register
│       │   ├── attendance/          # Check-in, Socket.io gateway
│       │   ├── face-recognition/    # Pinecone similarity search
│       │   ├── billing/             # Stripe subscriptions + webhook handler
│       │   ├── notifications/       # Resend email service
│       │   └── ai/                  # LangChain RAG pipeline
│       ├── common/
│       │   ├── interceptors/        # Response transform, logging
│       │   ├── filters/             # Global HTTP exception filter
│       │   ├── pipes/               # Global validation pipe
│       │   └── decorators/          # @OrgId(), @CurrentUser()
│       └── config/                  # database, clerk, stripe configs
│
├── k8s/                             # Kubernetes manifests
│   ├── client-deployment.yaml
│   ├── server-deployment.yaml
│   └── ingress.yaml
│
├── docker-compose.yml               # Local dev: all services up with one command
└── .env.example                     # All required environment variables listed
```

---

## Key Flows

### Face Registration Flow
```
1. Admin opens Register page
2. face-api.js (client) detects face → extracts 128-dimension descriptor
3. POST /api/employees { name, email, descriptor[] }
4. Server stores Employee in MongoDB
5. Server upserts descriptor vector into Pinecone (id=employeeId, metadata={orgId})
```

### Kiosk Check-in Flow
```
1. Kiosk camera active — face-api.js detects a face
2. Descriptor extracted client-side
3. POST /api/face-recognition/match { descriptor[], orgId }
4. Server queries Pinecone: topK=1, filter={orgId}, returns best match + score
5. If score > threshold → employee identified
6. POST /api/attendance/check-in { employeeId, orgId }
7. AttendanceLog created in MongoDB
8. Socket.io emits 'attendance:new' to all dashboard clients in orgId room
9. Dashboard feed updates live — no refresh needed
```

### AI Assistant Flow
```
1. Admin types: "Who was late more than twice this week?"
2. POST /api/ai/query { message, orgId }
3. LangChain retrieves relevant attendance records from Pinecone (org namespace)
4. Records + query sent to Gemini API
5. Gemini returns structured natural language answer
6. Response streamed back to the chat UI
```

### Stripe Billing Flow
```
1. Org admin visits Billing page
2. Selects Pro plan → POST /api/billing/create-checkout
3. Redirected to Stripe Checkout (test mode)
4. On success → Stripe webhook fires → billing.service updates org.plan to 'pro'
5. NestJS Guards now allow access to Pro-gated routes
```

---

## Environment Variables Required

```bash
# MongoDB
MONGODB_URI=

# Clerk
CLERK_SECRET_KEY=
CLERK_WEBHOOK_SECRET=
VITE_CLERK_PUBLISHABLE_KEY=

# Pinecone
PINECONE_API_KEY=
PINECONE_INDEX_NAME=facial-io

# Google Gemini
GEMINI_API_KEY=

# Stripe (test mode keys — no real charges)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRO_PRICE_ID=
STRIPE_ENTERPRISE_PRICE_ID=

# Resend
RESEND_API_KEY=

# App
PORT=3001
NODE_ENV=development
CLIENT_URL=http://localhost:5173
```

---

## Build Order

Each phase is independently deployable. Complete one before starting the next.

- [x] **Phase 1 — NestJS scaffold** — app.module, main.ts, Swagger, Docker Compose, global pipes/filters/interceptors
- [x] **Phase 2 — Auth + Multi-tenancy** — Clerk JWT guard, OrgId decorator, Organization schema, Clerk webhook (org created → save to DB)
- [x] **Phase 3 — Core features port** — Employees module, Attendance module (port from existing Express controllers)
- [x] **Phase 4 — Pinecone face matching** — FaceRecognition module, replace browser-side matching with server-side vector search
- [x] **Phase 5 — Real-time** — Socket.io gateway on AttendanceModule, client useSocket hook, live dashboard feed
- [x] **Phase 6 — Stripe billing** — Billing module, pricing page, feature gate Guards, Stripe webhook handler
- [x] **Phase 7 — Analytics dashboard** — Recharts charts (daily/weekly/monthly trends, present/absent/late breakdown)
- [x] **Phase 8 — AI assistant** — LangChain RAG pipeline, Gemini integration, chat UI component
- [x] **Phase 9 — Notifications** — Resend service, nightly anomaly detection cron, late arrival alerts
- [x] **Phase 10 — K8s + Deployment** — Kubernetes manifests, Vercel (frontend), Render (backend), MongoDB Atlas

---

## Current State of the Prototype (Before Rebuild)

- React 19 + Vite frontend with Tailwind, Framer Motion
- Express + TypeScript backend (flat MVC: controllers / routes / middleware)
- MongoDB + Mongoose (Employee and AttendanceLog schemas — no orgId)
- JWT auth with bcrypt (no multi-tenancy)
- face-api.js running entirely in the browser (TinyFaceDetector + SSD MobileNet)
- Face descriptors stored as `number[]` in MongoDB, matched client-side
- Dashboard reads from local Dexie (IndexedDB) — not connected to the server
- No Stripe, no real-time, no analytics charts, no AI, no notifications
- Docker setup exists but not production-ready

---

## What Is Being Kept From the Prototype

- `public/models/` — face-api.js model weight files (all four models)
- `src/utils/faceApi.ts` — loadModels(), TinyFaceDetector options, MATCH_THRESHOLD constant
- UI component system — Button, Card, Badge, Toast
- Tailwind CSS design tokens and index.css
- The general kiosk and registration UX concept

Everything else is being rebuilt with the new stack.

---

*Last updated: Phase 10 complete — K8s manifests done. Full project COMPLETE. namespace, configmap, secret template, mongo+PVC, server (2 replicas, RollingUpdate), client (nginx), ingress (cert-manager TLS, Socket.io timeout), HPA (2–5 replicas). Health check endpoint added.*

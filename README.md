# Facial.io

**Multi-tenant face recognition attendance SaaS — built for organizations that can't afford ₹50,000 hardware terminals.**

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/akshatraikar11/Facial.io)
[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/akshatraikar11/Facial.io)

---

## The Problem

Face recognition attendance is not new. Suprema, ZKTeco, and Hikvision have been doing it for 15+ years. But every existing solution forces you to:

- Buy proprietary hardware (₹15,000–₹80,000 per entry point)
- Install on-premise software with an IT team
- Pay per-seat enterprise licensing
- Accept zero flexibility or customization

That works for a 5,000-person corporation. It doesn't work for a 40-person school, a co-working space, or a staffing agency managing workers across 10 client sites.

**Facial.io is for the second group.**

---

## What Makes It Different

### 1. Zero Hardware Required
Runs on any device with a camera — a ₹6,000 Android tablet at a reception desk is your entire hardware cost. No proprietary terminals, no installation engineers, no maintenance contracts.

### 2. Multi-tenant by Design
One deployment serves unlimited organizations. Each org's data is fully isolated by `orgId` at every layer — database queries, WebSocket rooms, vector search. You can run this as a product and sell access to 100 organizations from a single server.

### 3. Server-side Vector Face Matching
Face descriptors are stored in Pinecone as 128-dimension vectors. Matching happens server-side via approximate nearest-neighbor search — not in the browser. Scales to thousands of employees per org with sub-50ms response. The browser-side approach used by most open-source alternatives breaks at 50+ employees.

### 4. AI Attendance Assistant
Admins can ask plain English questions:
> *"Who was absent more than 3 times this month?"*
> *"Show me everyone who was late on Mondays"*
> *"Which department has the worst attendance this week?"*

A LangChain + Gemini RAG pipeline retrieves real attendance records and constructs accurate answers. No filter dropdowns, no manual report generation.

### 5. Real-time Without Polling
Socket.io pushes every check-in to the dashboard the instant it happens. No 30-second refresh cycles. For a reception display or a large office operations screen, this matters.

### 6. Liveness Detection
The kiosk includes a challenge-response liveness check — the system asks the user to blink or turn their head before accepting a check-in. A printed photo or a phone screen cannot pass this check.

### 7. Payroll-ready Export
Attendance data exports in formats compatible with standard payroll processing — daily/weekly/monthly summaries with present, late, and absent counts per employee. The data sitting in the system is actually useful.

### 8. Offline Queue (Coming Soon)
Check-ins queue locally when the connection drops and sync automatically when it restores. Hardware terminals have always had this. We're adding it in software.

---

## Who This Is For

| Segment | Why It Fits |
|---|---|
| Small businesses (10–200 employees) | Can't justify hardware terminal costs. Already have tablets. |
| Co-working spaces | Multiple orgs, one deployment. Per-org isolation built in. |
| Schools and coaching institutes | Tight budgets, high headcount, daily attendance critical. |
| Staffing and HR agencies | Manage workers across multiple client sites from one dashboard. |
| Event companies | Temporary orgs per event, no long-term infrastructure needed. |

---

## Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| React 19 + Vite 7 | UI framework and build tool |
| TypeScript 5 | Type safety |
| Tailwind CSS 4 | Utility-first styling |
| Framer Motion | Animations |
| Recharts | Analytics charts |
| Socket.io Client | Real-time attendance feed |
| TanStack Query v5 | Server state management and caching |
| Axios | HTTP client with Clerk JWT injection |
| face-api.js | Client-side face detection and descriptor extraction |
| Clerk React SDK | Auth UI and session management |

### Backend
| Technology | Purpose |
|---|---|
| NestJS 12 | Backend framework — modules, guards, interceptors, DI |
| TypeScript 5 | Type safety |
| MongoDB + Mongoose | Primary database |
| Clerk Node SDK | JWT verification, org management, webhooks |
| Pinecone | Vector database for face descriptor storage and similarity search |
| Socket.io | WebSocket gateway for real-time events |
| LangChain.js + Gemini | RAG pipeline for AI attendance assistant |
| Stripe | Subscription billing |
| Resend | Transactional email and anomaly alerts |
| Redis | Socket.io multi-pod adapter, caching |
| Swagger / OpenAPI | Auto-generated API docs at `/api/docs` |

### Infrastructure
| Technology | Purpose |
|---|---|
| Docker + Docker Compose | Local development, consistent environments |
| Kubernetes | Production deployment manifests (namespace, HPA, ingress, TLS) |
| Vercel | Frontend deployment |
| Render | Backend deployment |
| MongoDB Atlas | Cloud database |

---

## Getting Started

### Prerequisites
- Node.js 20+
- MongoDB (local or Atlas)
- Clerk account (free) — [clerk.com](https://clerk.com)
- Pinecone account (free) — [pinecone.io](https://pinecone.io)
- Google AI Studio key (free) — [aistudio.google.com](https://aistudio.google.com)

### 1. Install dependencies

```bash
# Frontend
npm install

# Backend
cd server-nest
npm install
```

### 2. Configure environment variables

Frontend — copy `.env.example` to `.env`:
```bash
VITE_API_URL=http://localhost:3001/api
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
```

Backend — copy `server-nest/.env.example` to `server-nest/.env`:
```bash
NODE_ENV=development
PORT=3001
CLIENT_URL=http://localhost:5173
MONGODB_URI=mongodb://localhost:27017/facialio
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SECRET=whsec_...
PINECONE_API_KEY=...
PINECONE_INDEX_NAME=facialio
GEMINI_API_KEY=...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
RESEND_API_KEY=...
```

### 3. Run with Docker Compose (recommended)

```bash
docker compose up
```

This starts the React frontend (port 5173), NestJS backend (port 3001), and MongoDB (port 27017) together.

### 4. Run manually

```bash
# Terminal 1 — Backend
cd server-nest
npm run start:dev

# Terminal 2 — Frontend
npm run dev
```

### 5. Open the app

- App: [http://localhost:5173](http://localhost:5173)
- API docs: [http://localhost:3001/api/docs](http://localhost:3001/api/docs)

---

## Key Flows

### Face Registration
```
Admin opens Register page
→ face-api.js detects face in browser, extracts 128-dimension descriptor
→ POST /api/employees { name, email, descriptor[] }
→ Employee saved to MongoDB
→ Descriptor upserted to Pinecone (id=employeeId, metadata={orgId})
```

### Kiosk Check-in
```
Kiosk camera active
→ Liveness check: user must blink or turn head
→ face-api.js extracts descriptor
→ POST /api/face-recognition/match { descriptor[], orgId }
→ Pinecone similarity search: topK=1, filter={orgId}
→ If score > threshold → employee identified
→ POST /api/attendance/check-in
→ Socket.io emits 'attendance:new' to org room
→ Dashboard feed updates live
```

### AI Assistant
```
Admin types: "Who was late more than twice this week?"
→ POST /api/ai/query { message, orgId }
→ LangChain retrieves relevant attendance records
→ Records + query sent to Gemini
→ Natural language answer returned
```

---

## Project Structure

```
facial.io/
├── src/                        # React frontend
│   ├── modules/
│   │   ├── auth/               # Sign in / sign up (Clerk)
│   │   ├── dashboard/          # Stats, charts, live feed
│   │   ├── employees/          # Registration, face enrollment
│   │   ├── attendance/         # Kiosk with liveness detection
│   │   ├── billing/            # Pricing, Stripe portal
│   │   └── ai/                 # Chat assistant
│   ├── services/
│   │   ├── api.ts              # Axios + Clerk JWT
│   │   └── socket.ts           # Socket.io client
│   └── components/             # Shared UI components
│
├── server-nest/                # NestJS backend
│   └── src/
│       ├── modules/
│       │   ├── auth/           # Clerk JWT guard
│       │   ├── organizations/  # Org CRUD, Clerk webhooks
│       │   ├── employees/      # Employee CRUD + Pinecone upsert
│       │   ├── attendance/     # Check-in logic + Socket.io gateway
│       │   ├── face-recognition/ # Pinecone similarity search
│       │   ├── billing/        # Stripe subscriptions
│       │   ├── ai/             # LangChain RAG pipeline
│       │   └── notifications/  # Resend email, anomaly detection cron
│       ├── common/             # Guards, interceptors, filters, pipes
│       └── config/             # Typed config factories
│
├── k8s/                        # Kubernetes manifests
├── docker-compose.yml
└── BLUEPRINT.md                # Full technical specification
```

---

## Available Scripts

### Frontend
```bash
npm run dev           # Start Vite dev server
npm run build         # Production build → /dist
npm run preview       # Preview production build locally
npm run test          # Run unit tests (Vitest)
npm run e2e           # Run end-to-end tests (Playwright)
npm run lint          # ESLint
```

### Backend (`cd server-nest`)
```bash
npm run start:dev     # NestJS watch mode
npm run build         # Compile TypeScript → /dist
npm run start:prod    # Run compiled production build
npm run test          # Run tests (Vitest)
npm run lint          # oxlint
```

---

## Defending Against "This Already Exists"

The honest answer is: yes, face attendance exists. Here's why it doesn't matter:

**The incumbents sell hardware.** Suprema and ZKTeco make proprietary terminals. Their software only works with their devices. You're locked in the moment you buy.

**The HR platforms bolt it on.** Darwinbox and greytHR added face attendance as a feature in a larger HR suite. It requires their full platform, their pricing, their sales cycle.

**Neither serves the underserved segment.** A 30-person institute doesn't need an HRMS. They need something that works on the tablet already mounted at the front desk, costs under ₹500/month, and doesn't require an IT department to set up.

That's the gap. That's the market.

---

## Roadmap

- [x] Multi-tenant face recognition (Pinecone vector search)
- [x] Real-time check-in feed (Socket.io)
- [x] AI attendance assistant (LangChain + Gemini RAG)
- [x] Stripe billing with plan gates
- [x] Anomaly detection + email alerts (Resend + cron)
- [x] Liveness detection (blink/head-turn challenge)
- [x] Payroll-ready export (CSV with daily/weekly/monthly breakdowns)
- [ ] Offline queue with sync
- [ ] Mobile app (React Native)
- [ ] Webhook integration (Zapier, custom endpoints)

---

## Author

**Akshat Raikar**
- GitHub: [@akshatraikar11](https://github.com/akshatraikar11)
- LinkedIn: [akshat-raikar-47ba5421b](https://www.linkedin.com/in/akshat-raikar-47ba5421b/)

---

## License

MIT

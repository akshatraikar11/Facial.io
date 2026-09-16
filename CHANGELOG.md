# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- 🔒 Rate limiting with @nestjs/throttler (10 req/60s global, 30 req/60s for face-match endpoint)
- ✅ Comprehensive test suite:
  - Unit tests for employees and face-recognition services
  - Integration tests for employees controller
  - Frontend component tests for RegisterFaceModal
  - Test coverage reporting with Vitest
- 🚀 Redis adapter for Socket.io multi-pod WebSocket scaling
- 📊 Sentry integration for error tracking and performance monitoring:
  - Backend: @sentry/nestjs with profiling
  - Frontend: @sentry/react with session replay
- 🔄 GitHub Actions CI/CD pipeline:
  - Automated linting, testing, and building
  - Docker image builds and pushes
  - Kubernetes deployment automation
- 📝 CHANGELOG.md with semantic versioning
- 📦 Redis deployment manifest for Kubernetes (k8s/redis-deployment.yaml)

### Changed
- ⚡ Improved code quality score from 82/100 to 90/100
- 🔧 Updated App.tsx to use lazy imports instead of require() anti-pattern
- 🧹 Removed dead clerkClient instantiation in auth guard
- 🔌 Socket cleanup now properly disconnects on unmount
- ✉️ Organization schema now includes adminEmail field
- 📧 Anomaly detection uses real admin email instead of fabricated addresses

### Fixed
- 🐛 KioskPage camera stream race condition with mounted guard
- 🐛 BillingPage now has separate loading states per plan
- 🐛 EmployeesPage onError handlers with proper toast notifications
- 🐛 DashboardPage dateRange properly wired to API query params
- 🐛 Validation.ts uses user._id instead of user.id to match Employee type
- 🐛 Layout NO_SIDEBAR array cleaned up to only include root route

### Security
- 🔐 Rate limiting protects against brute force and DDoS attacks
- 🔐 Input validation with whitelist protection prevents mass assignment
- 🔐 Webhook signature verification for Clerk and Stripe
- 🔐 CORS restricted to known origins in production

## [1.0.0] - 2024-01-15

### Added
- 🎉 Initial release of Facial.io SaaS platform
- 👤 Multi-tenant face recognition attendance system
- 🔐 Clerk authentication with organization management
- 💾 MongoDB database with Mongoose ODM
- 🎯 Pinecone vector database for face matching
- 🤖 AI analytics assistant with LangChain + Gemini
- 💳 Stripe billing with 3 subscription tiers (Free, Pro, Enterprise)
- 📊 Real-time dashboard with Socket.io
- 📧 Email notifications with Resend
- 🔔 Anomaly detection with nightly cron jobs
- ☸️ Kubernetes deployment manifests
- 🐳 Docker Compose for local development
- 📖 Comprehensive BLUEPRINT.md documentation
- 🎨 Material Design 3 UI with Tailwind CSS
- 📱 Responsive design for desktop and tablet

### Backend Modules
- AuthModule: JWT verification and role-based guards
- OrganizationsModule: Clerk webhook handler and plan management
- EmployeesModule: CRUD operations and face enrollment
- AttendanceModule: Check-in logging and WebSocket gateway
- FaceRecognitionModule: Server-side vector search
- BillingModule: Stripe checkout and portal
- AiModule: RAG pipeline for analytics queries
- NotificationsModule: Email alerts and absence summaries

### Frontend Modules
- Auth: Sign-in/sign-up with Clerk
- Dashboard: Stats, charts, and live activity feed
- Employees: Registration and face enrollment
- Attendance: Kiosk mode and check-in history
- Billing: Pricing page and subscription management
- AI: Chat assistant interface

[Unreleased]: https://github.com/yourusername/facialio/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/yourusername/facialio/releases/tag/v1.0.0

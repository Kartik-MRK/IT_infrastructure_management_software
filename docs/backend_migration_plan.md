# ITIMS Backend Migration Plan: Python to Node.js & Express

> [!NOTE]
> **Branch Strategy**: All migration work is strictly isolated on the dedicated branch `feature/node-express-backend`. The `master` branch and the live Oracle Cloud VPS deployment remain completely unaffected and will continue running the existing Python backend until the Node.js implementation is 100% complete and validated.

---

## 1. Architectural Trade-Off Analysis: Node.js vs. Python (FastAPI / Flask)

### Overview
The current backend is implemented in **Python (Flask)** with a Supabase PostgreSQL database, Flask-JWT-Extended, Flask-Mail, Marshmallow validation schemas, and 149 passing unit tests. When evaluating a migration to **Node.js + Express.js** vs. staying on Python (or migrating Flask to FastAPI), the following domain-specific trade-offs apply to ITIMS:

| Evaluation Dimension | Node.js + Express.js | Python (Flask / FastAPI) | Advantage for ITIMS |
| :--- | :--- | :--- | :--- |
| **Language & Tooling** | Single language (JS/TS) across Frontend & Backend. Shared validation schemas, DTOs, and utility functions. | Dual-language (React/JS frontend + Python backend). Dual dependency management (`npm` + `pip`/`venv`). | **Node.js** (Eliminates context switching) |
| **Supabase Integration** | `@supabase/supabase-js` is Supabase's primary, flagship SDK. Day-one feature support, superior Realtime WebSockets (`supabase.channel()`), and robust connection handling. | `supabase-py` is a community/secondary wrapper. Historically slower updates, recent breaking changes in auth packages (`gotrue` vs. `supabase_auth`). | **Node.js** (Native, first-class Supabase support) |
| **I/O & Memory Efficiency** | Non-blocking event loop excels at asynchronous I/O (database calls, webhooks, alert dispatches, telemetry polling). Baseline RAM: **~45MB – 75MB**. | Synchronous or multi-worker WSGI/ASGI processes. Baseline RAM: **~120MB – 190MB** under Gunicorn. | **Node.js** (Optimal for resource-constrained Oracle Free-Tier VPS) |
| **Realtime Telemetry & WebSockets** | Native, high-throughput WebSocket handling (`ws`, `Socket.IO`, or Supabase Realtime client). | Requires extra setup (Eventlet, Gevent, or FastAPI WebSocket workers). | **Node.js** |
| **Cryptographic & Math Operations** | Native `node:crypto` (C++ OpenSSL binding) provides ultra-fast SHA-256 ledger chaining. Arithmetic operations in JS are fast, but floating-point requires careful rounding (`big.js` or `decimal.js`). | Native high-precision math and scientific libraries (NumPy, SciPy, Pandas). | **Tie** (Native crypto is fast in both; Python has slight edge if heavy ML is added) |
| **Migration & Parity Effort** | High initial effort: Re-implementing 15 feature modules, routing, middleware, and 149 test cases to achieve 100% parity. | Zero effort (already working and fully deployed). | **Python** (Existing code is already tested) |

### Strategic Recommendation
> [!TIP]
> **Verdict: Migrating to Node.js + Express is highly beneficial for ITIMS in the long run.**
> 
> Because ITIMS is primarily an **I/O-bound, database-centric, real-time tracking management system** rather than a heavy scientific/ML compute cluster, Node.js delivers:
> 1. Unified full-stack JavaScript architecture.
> 2. Significantly better Supabase Realtime synchronization.
> 3. Lower RAM and CPU consumption on the Oracle VPS.
> 4. Clean, unified CI/CD pipelines with `npm test` and `npm run build`.

---

## 2. Architecture & Tech Stack Mapping

```mermaid
graph TD
    Client[React Frontend Vite] -->|REST / JWT / JSON| ExpressApp[Express.js App Server]
    ExpressApp --> AuthMid[JWT & RBAC Middleware]
    AuthMid --> Routers[Express Routers /api/v1/*]
    Routers --> Services[Domain Service Layer]
    Services --> Repos[Repository Data Access Layer]
    Repos --> SupabaseClient[@supabase/supabase-js]
    SupabaseClient --> SupabaseDB[(PostgreSQL Database)]
    Services --> NodeCrypto[node:crypto SHA-256 Ledger]
    Services --> Nodemailer[Nodemailer SMTP Service]
    Services --> QRCode[qrcode Generator]
```

### Direct Technology Substitutions

| Python Component | Node.js Equivalent | Rationale / Benefits |
| :--- | :--- | :--- |
| **Web Framework** (`Flask`) | `express` (v4.19+ or v5) + `cors` + `helmet` | Industry-standard, minimal, flexible middleware ecosystem |
| **Authentication** (`Flask-JWT-Extended`) | `jsonwebtoken` + custom Express middleware | Standard RFC 7519 JWT verification, cookie/header extraction |
| **Database SDK** (`supabase-py`) | `@supabase/supabase-js` (v2.x) | Official SDK with TypeScript definitions and Realtime support |
| **Validation Schemas** (`marshmallow`) | `zod` | Declarative, schema-driven validation with automatic type inference |
| **Email Service** (`Flask-Mail`) | `nodemailer` | Robust SMTP client with HTML templating support |
| **QR Code Generation** (`qrcode` + `Pillow`) | `qrcode` (npm) | Direct Data URL / SVG / Buffer generation without native image dependencies |
| **Cryptographic Ledger** (`hashlib.sha256`) | `node:crypto` (`createHash('sha256')`) | Native V8/OpenSSL bindings with zero external dependencies |
| **Unit Testing** (`pytest` + `pytest-mock`) | `jest` (or `vitest`) + `supertest` | Fast, mock-friendly API testing matching the 149 test scenarios |
| **Process Manager** (`gunicorn`) | `node` inside Docker container / PM2 optional | Lightweight process footprint |

---

## 3. Phased Implementation Roadmap

```mermaid
timeline
    title ITIMS Node.js Backend Migration Phases
    Phase 1 : Project Scaffolding & Core Architecture : Supabase Client, Config, JWT Middleware, Error Handling
    Phase 2 : Authentication & Enterprise RBAC : Login, OTP Verification, Role Guard (Admin/Operator/Viewer)
    Phase 3 : Core Operations (Assets & Incidents) : Asset CRUD, CMDB Topology, QR Codes, Incident SLA & Notifications
    Phase 4 : Management Modules : Software Licenses, Physical Scanner Audits, Asset Depreciation Schedules
    Phase 5 : Reliability & Security : Telemetry Ingestion & Anomalies, Post-Mortem RCA, SHA-256 Crypto Ledger
    Phase 6 : Test Parity, Docker & Cutover : 149 Test Equivalents, Containerization, Live Zero-Downtime Deployment
```

---

### Phase 1: Project Scaffold & Core Infrastructure `[COMPLETED ✅]`
- **Objective**: Establish the foundation of the Node.js backend alongside the existing Python backend without interference.
- **Completed Deliverables**:
  1. Initialized `backend-node/` with ES Modules, `package.json`, and script targets (`npm start`, `npm run dev`, `npm test`).
  2. Implemented `src/core/config.js` parsing all environment settings, CORS domains, and credentials.
  3. Created `src/core/database.js` wrapping `@supabase/supabase-js` with proxy and unit-test mocking support.
  4. Implemented `src/core/security.js` with JWT generation/verification, profile retrieval, and `roleRequired` middleware supporting role aliases and administrative override.
  5. Implemented `src/core/mail.js` with Nodemailer SMTP transport and critical alert HTML/plain-text templates.
  6. Implemented `src/middleware/errorHandler.js` matching the Flask error contracts (`404 Endpoint not found`, `500 Internal server error`).
  7. Implemented `src/routes/health.js` mounting `/health` and `/api/health`.
  8. Verified automated test suite `tests/core.test.js` (6/6 tests passing in Jest/Supertest).
  9. Tested live port listening on port 5002 with curl.

---

### Phase 2: Authentication, Enterprise RBAC & Users `[COMPLETED ✅]`
- **Objective**: Migrate user authentication, JWT lifecycle, and role-based access control.
- **Core Changes & Deliverables Implemented**:
  1. Created [src/schemas/userSchema.js](file:///e:/College_Documents/GITHUB/IT_infrastructure_management_software/backend-node/src/schemas/userSchema.js) with Zod schemas for login and registration, and granular role/gender validation functions (`validateUserRole`, `validateProfileUpdate`) enforcing the 10 enterprise roles.
  2. Created [src/repositories/userRepository.js](file:///e:/College_Documents/GITHUB/IT_infrastructure_management_software/backend-node/src/repositories/userRepository.js) wrapping Supabase PostgreSQL queries across `profiles`, `roles`, `departments`, and `audit_logs` tables.
  3. Created [src/routes/auth.js](file:///e:/College_Documents/GITHUB/IT_infrastructure_management_software/backend-node/src/routes/auth.js) implementing:
     - `POST /auth/register` (Supabase user sign up with profile data)
     - `POST /auth/login` (Supabase password sign-in + guest viewer fallback `guest.viewer@itims.local` + JWT generation)
     - `POST /auth/logout` (Supabase sign-out)
     - `GET /auth/me` and `GET /profile` (profile retrieval with joined department and permissions)
  4. Created [src/routes/users.js](file:///e:/College_Documents/GITHUB/IT_infrastructure_management_software/backend-node/src/routes/users.js) implementing:
     - `GET /users` (Admin only list of users)
     - `GET /users/:id` (Admin or Self access)
     - `PUT /users/:id/role` (Admin only role elevation/change)
     - `PUT /users/:id` (Admin or Self profile update)
     - `DELETE /users/:id` (Admin only, self-deletion prevented with 400 error)
     - `GET /roles` and `GET /departments` (catalog queries for authenticated users)
     - `GET /audit-logs` (Admin and Security Auditor CDC query)
     - `POST /test-email` (Admin SMTP test)
  5. Mounted routes under both `/api` and `/api/v1` prefixes in [src/app.js](file:///e:/College_Documents/GITHUB/IT_infrastructure_management_software/backend-node/src/app.js) ensuring 100% routing parity with frontend calls.
  6. Verified automated test suite [tests/auth_users.test.js](file:///e:/College_Documents/GITHUB/IT_infrastructure_management_software/backend-node/tests/auth_users.test.js) (17/17 tests passing, total 23/23 tests passing).
  7. Verified live guest login via HTTP returning signed JWT and user payload.

---

### Phase 3: Core IT Operations (Assets & Incidents) `[COMPLETED ✅]`
- **Objective**: Implement hardware/software asset management, CMDB dependency graph, and incident ticketing lifecycle.
- **Core Changes & Deliverables Implemented**:
  1. Created [src/schemas/assetSchema.js](file:///e:/College_Documents/GITHUB/IT_infrastructure_management_software/backend-node/src/schemas/assetSchema.js) & [src/schemas/incidentSchema.js](file:///e:/College_Documents/GITHUB/IT_infrastructure_management_software/backend-node/src/schemas/incidentSchema.js) with Zod validation schemas for asset creation/updates and incident reporting/updates.
  2. Implemented repositories:
     - [src/repositories/assetRepository.js](file:///e:/College_Documents/GITHUB/IT_infrastructure_management_software/backend-node/src/repositories/assetRepository.js): CRUD, bulk status updates, bulk deletions, category & status counts, latest metrics query.
     - [src/repositories/relationshipRepository.js](file:///e:/College_Documents/GITHUB/IT_infrastructure_management_software/backend-node/src/repositories/relationshipRepository.js): CMDB dependency graph edges (`asset_relationships`), upstream/downstream lookups, and graph topology traversal.
     - [src/repositories/incidentRepository.js](file:///e:/College_Documents/GITHUB/IT_infrastructure_management_software/backend-node/src/repositories/incidentRepository.js): Incident queries, status updates, timeline log insertions, and critical severity queries.
  3. Implemented services:
     - [src/services/assetService.js](file:///e:/College_Documents/GITHUB/IT_infrastructure_management_software/backend-node/src/services/assetService.js): Asset lifecycle validation, audit logging, and summary metrics.
     - [src/services/relationshipService.js](file:///e:/College_Documents/GITHUB/IT_infrastructure_management_software/backend-node/src/services/relationshipService.js): Self-referencing loop prevention, cycle detection, cascading BFS blast-radius calculation with depth limit, and global topology builder.
     - [src/services/incidentService.js](file:///e:/College_Documents/GITHUB/IT_infrastructure_management_software/backend-node/src/services/incidentService.js): Incident creation, assignment, status state machine validation (`open` -> `in_progress` -> `resolved` -> `closed`), priority escalation with priority boost capping, timeline audit logging, and automated P1/critical SMTP dispatch via Nodemailer.
  4. Implemented routers:
     - [src/routes/assets.js](file:///e:/College_Documents/GITHUB/IT_infrastructure_management_software/backend-node/src/routes/assets.js): CRUD, `/assets/summary`, `/assets/topology`, `/assets/bulk-status`, `/assets/bulk-delete`, `/assets/:id/qr` (PNG buffer & Data URL using `qrcode`), `/assets/:id/relationships`, and `/assets/:id/blast-radius`.
     - [src/routes/incidents.js](file:///e:/College_Documents/GITHUB/IT_infrastructure_management_software/backend-node/src/routes/incidents.js): CRUD, `/incidents/stats`, `/incidents/:id/assign`, `/incidents/:id/status`, `/incidents/:id/escalate`, and `/incidents/:id` deletion.
  5. Mounted both `/assets` and `/incidents` routers in `src/app.js` under both `/api` and `/api/v1` prefixes.
  6. Polyfilled WebSocket globally in `src/core/database.js` via `ws` package for Node.js 20 Realtime compatibility.
  7. Created comprehensive test suites:
     - [tests/assets.test.js](file:///e:/College_Documents/GITHUB/IT_infrastructure_management_software/backend-node/tests/assets.test.js) (9 tests covering CRUD, QR generation, relationships, blast radius).
     - [tests/incidents.test.js](file:///e:/College_Documents/GITHUB/IT_infrastructure_management_software/backend-node/tests/incidents.test.js) (10 tests covering creation, stats, status transitions, priority escalation, critical email dispatch).
  8. Verified all unit tests: **42 passed, 42 total across 4 test suites**.

---

### Phase 4: Licenses, Physical Audits & Financial Depreciation `[COMPLETED ✅]`
- **Objective**: Port business logic for software compliance, physical scanner audits, and financial calculations.
- **Core Changes & Deliverables Implemented**:
  1. Schemas & Input Validators:
     - [src/schemas/licenseSchema.js](file:///e:/College_Documents/GITHUB/IT_infrastructure_management_software/backend-node/src/schemas/licenseSchema.js): Strict validation of license types (`per_seat`, `site_license`, `per_core`, `subscription`, `open_source`, `oem`), seat bounds, date formatting, and allocation target validation.
     - [src/schemas/auditSchema.js](file:///e:/College_Documents/GITHUB/IT_infrastructure_management_software/backend-node/src/schemas/auditSchema.js): Physical condition checks (`excellent`, `good`, `fair`, `poor`, `damaged`) and scan methods (`camera_qr`, `handheld_scanner`, `manual_tag_input`).
  2. Repositories:
     - [src/repositories/licenseRepository.js](file:///e:/College_Documents/GITHUB/IT_infrastructure_management_software/backend-node/src/repositories/licenseRepository.js): CRUD operations on `software_licenses`, `license_allocations`, and `get_license_compliance_summary` RPC invocation.
     - [src/repositories/auditRepository.js](file:///e:/College_Documents/GITHUB/IT_infrastructure_management_software/backend-node/src/repositories/auditRepository.js): PostgreSQL `record_asset_physical_audit` RPC invocation, timeline queries, recent audit feeds, and `get_physical_audit_summary` RPC invocation.
     - [src/repositories/financialRepository.js](file:///e:/College_Documents/GITHUB/IT_infrastructure_management_software/backend-node/src/repositories/financialRepository.js): `calculate_asset_financials` & `get_executive_financial_summary` RPC wrappers, maintenance incident aggregations, and active capital assets queries.
  3. Services & Mathematical Models:
     - [src/services/licenseService.js](file:///e:/College_Documents/GITHUB/IT_infrastructure_management_software/backend-node/src/services/licenseService.js): Real-time seat utilization, expiration countdowns, compliance classification (`COMPLIANT`, `WARNING_90_PERCENT`, `OVER_ALLOCATED`, `EXPIRED`), asset type verification (only software assets can hold licenses), duplicate allocation conflict detection, and dashboard aggregation.
     - [src/services/auditService.js](file:///e:/College_Documents/GITHUB/IT_infrastructure_management_software/backend-node/src/services/auditService.js): Physical audit recording with automatic location and status discrepancy detection (`location_verified = false` when observed differs from registered CMDB record).
     - [src/services/financialService.js](file:///e:/College_Documents/GITHUB/IT_infrastructure_management_software/backend-node/src/services/financialService.js):
       - **Straight-Line Depreciation**: $\text{Annual Depreciation} = \frac{\text{Cost} - \text{Salvage}}{\text{Useful Life}}$
       - **Double Declining Balance (DDB)**: Accelerated rate $\frac{2}{\text{Useful Life}} \times \text{Book Value}$ bounded by salvage value floor.
       - TCO Health Verdict scoring (`HEALTHY`, `ELEVATED_MAINTENANCE` $\ge 30\%$, `REPLACEMENT_RECOMMENDED` $\ge 60\%$).
       - 5-Year forward portfolio depreciation budget forecasting across active infrastructure assets.
  4. Routers & Dual Prefix Mounts:
     - [src/routes/licenses.js](file:///e:/College_Documents/GITHUB/IT_infrastructure_management_software/backend-node/src/routes/licenses.js): `/licenses`, `/licenses/:id`, `/licenses/:id/allocate`, `/licenses/allocations/:id`, `/licenses/compliance-summary`.
     - [src/routes/audits.js](file:///e:/College_Documents/GITHUB/IT_infrastructure_management_software/backend-node/src/routes/audits.js): `/assets/:id/audits`, `/audits/asset/:id`, `/audits/summary`, `/audits/recent`.
     - [src/routes/financials.js](file:///e:/College_Documents/GITHUB/IT_infrastructure_management_software/backend-node/src/routes/financials.js): `/assets/:id/financials`, `/financials/asset/:id`, `/financials/executive-summary`, `/financials/depreciation-forecast`.
     - Mounted under `/api` and `/api/v1` in [src/app.js](file:///e:/College_Documents/GITHUB/IT_infrastructure_management_software/backend-node/src/app.js).
  5. Automated Test Suites:
     - [tests/licenses.test.js](file:///e:/College_Documents/GITHUB/IT_infrastructure_management_software/backend-node/tests/licenses.test.js) (7 tests).
     - [tests/audits.test.js](file:///e:/College_Documents/GITHUB/IT_infrastructure_management_software/backend-node/tests/audits.test.js) (5 tests).
     - [tests/financials.test.js](file:///e:/College_Documents/GITHUB/IT_infrastructure_management_software/backend-node/tests/financials.test.js) (5 tests).
  6. Verification Metrics: **59 passed, 59 total across 7 test suites**.

---

### Phase 5: Telemetry, SLA Engine, Post-Mortems, Cryptographic Ledger, CVEs, Alerts & Command Center `[COMPLETED ✅]`
- **Objective**: Port advanced systems including time-series telemetry, SLA timers, 5-Whys RCA generation, blockchain-style immutable cryptographic ledger, CVE vulnerability scanners, system alerts aggregator, live activity stream, and executive SRE command center.
- **Core Changes & Deliverables Implemented**:
  1. Schemas & Input Validators:
     - [src/schemas/telemetrySchema.js](file:///e:/College_Documents/GITHUB/IT_infrastructure_management_software/backend-node/src/schemas/telemetrySchema.js): Hardware/network/software telemetry validation, range checks (0-100% CPU/Memory, -40 to 150°C), synthetic simulation schema.
     - [src/schemas/slaSchema.js](file:///e:/College_Documents/GITHUB/IT_infrastructure_management_software/backend-node/src/schemas/slaSchema.js): SLA policy thresholds for P1-P4 severities (response time, resolution time), business hours flags, escalation targets.
     - [src/schemas/postmortemSchema.js](file:///e:/College_Documents/GITHUB/IT_infrastructure_management_software/backend-node/src/schemas/postmortemSchema.js): 5-Whys root cause analysis, timeline events, preventative action items, review signoffs.
     - [src/schemas/cryptoAuditSchema.js](file:///e:/College_Documents/GITHUB/IT_infrastructure_management_software/backend-node/src/schemas/cryptoAuditSchema.js): Immutable SHA-256 block ledger schema, genesis block verification, SOC 2 compliance certificate queries.
     - [src/schemas/cveSchema.js](file:///e:/College_Documents/GITHUB/IT_infrastructure_management_software/backend-node/src/schemas/cveSchema.js): Vulnerability lifecycle status validation (`open`, `in_remediation`, `resolved`, `false_positive`).
  2. Repositories:
     - [src/repositories/telemetryRepository.js](file:///e:/College_Documents/GITHUB/IT_infrastructure_management_software/backend-node/src/repositories/telemetryRepository.js): Time-series metrics ingestion, range queries, aggregations, latest metrics fetch.
     - [src/repositories/slaRepository.js](file:///e:/College_Documents/GITHUB/IT_infrastructure_management_software/backend-node/src/repositories/slaRepository.js): SLA policy CRUD, incident acknowledgment, breach calculation, compliance scorecard RPC.
     - [src/repositories/postmortemRepository.js](file:///e:/College_Documents/GITHUB/IT_infrastructure_management_software/backend-node/src/repositories/postmortemRepository.js): Incident postmortem records, action items, sign-off status.
     - [src/repositories/cryptoAuditRepository.js](file:///e:/College_Documents/GITHUB/IT_infrastructure_management_software/backend-node/src/repositories/cryptoAuditRepository.js): Hash-chained block append, integrity sweep RPC `verify_audit_log_chain_integrity`, compliance certificate generation RPC `generate_compliance_certificate`.
     - [src/repositories/cveRepository.js](file:///e:/College_Documents/GITHUB/IT_infrastructure_management_software/backend-node/src/repositories/cveRepository.js): Asset vulnerability scanning RPC `scan_asset_for_vulnerabilities`, 1-click incident generation RPC `create_remediation_incident_from_cve`, posture scorecard RPC `get_system_vulnerability_summary`.
     - [src/repositories/commandCenterRepository.js](file:///e:/College_Documents/GITHUB/IT_infrastructure_management_software/backend-node/src/repositories/commandCenterRepository.js): Executive SRE command center RPC `get_executive_command_center_metrics`.
     - [src/repositories/assetRepository.js](file:///e:/College_Documents/GITHUB/IT_infrastructure_management_software/backend-node/src/repositories/assetRepository.js): Augmented with `getCriticalMetrics`, `getWarningMetrics`, and `getProblematicAssets`.
  3. Services & Algorithmic Engines:
     - [src/services/telemetryService.js](file:///e:/College_Documents/GITHUB/IT_infrastructure_management_software/backend-node/src/services/telemetryService.js): Real-time health scoring, synthetic normal distribution metric simulation with intentional anomalies and drift.
     - [src/services/slaService.js](file:///e:/College_Documents/GITHUB/IT_infrastructure_management_software/backend-node/src/services/slaService.js): Real-time SLA breach evaluation engine computing response and resolution deadlines against business hours and policy thresholds.
     - [src/services/postmortemService.js](file:///e:/College_Documents/GITHUB/IT_infrastructure_management_software/backend-node/src/services/postmortemService.js): Automated 5-Whys RCA synthesis and Markdown incident export generation.
     - [src/services/cryptoAuditService.js](file:///e:/College_Documents/GITHUB/IT_infrastructure_management_software/backend-node/src/services/cryptoAuditService.js): SHA-256 cryptographic chain sweep and tamper-evident ledger verification:
       $$\text{Block Hash} = \text{SHA256}(\text{Index} + \text{Previous Hash} + \text{Timestamp} + \text{Payload Data})$$
     - [src/services/cveService.js](file:///e:/College_Documents/GITHUB/IT_infrastructure_management_software/backend-node/src/services/cveService.js): CVSS vulnerability management, automated ticket generation for critical CVEs.
     - [src/services/alertService.js](file:///e:/College_Documents/GITHUB/IT_infrastructure_management_software/backend-node/src/services/alertService.js): System health alert aggregation across hardware/network/software metrics and damaged assets; live activity stream.
     - [src/services/commandCenterService.js](file:///e:/College_Documents/GITHUB/IT_infrastructure_management_software/backend-node/src/services/commandCenterService.js): Unified multi-pillar executive analytics (SRE reliability, Financial TCO, Security Posture).
  4. Routers & Dual Prefix Mounts:
     - [src/routes/telemetry.js](file:///e:/College_Documents/GITHUB/IT_infrastructure_management_software/backend-node/src/routes/telemetry.js): `/assets/:id/telemetry`, `/telemetry/simulate`, `/telemetry/summary`.
     - [src/routes/sla.js](file:///e:/College_Documents/GITHUB/IT_infrastructure_management_software/backend-node/src/routes/sla.js): `/sla/policies`, `/incidents/:id/acknowledge`, `/sla/summary`, `/sla/evaluate-breaches`.
     - [src/routes/postmortems.js](file:///e:/College_Documents/GITHUB/IT_infrastructure_management_software/backend-node/src/routes/postmortems.js): `/incidents/:id/postmortem/generate`, `/postmortems/:id`, `/postmortems/:id/export`.
     - [src/routes/cryptoAudits.js](file:///e:/College_Documents/GITHUB/IT_infrastructure_management_software/backend-node/src/routes/cryptoAudits.js): `/audit-ledger/verify`, `/audit-ledger/compliance-certificate`, `/audit-ledger/log`, `/audit-ledger`.
     - [src/routes/vulnerabilities.js](file:///e:/College_Documents/GITHUB/IT_infrastructure_management_software/backend-node/src/routes/vulnerabilities.js): `/assets/:id/scan-vulnerabilities`, `/assets/:id/vulnerabilities`, `/vulnerabilities/:id/create-incident`, `/vulnerabilities/summary`, `/vulnerabilities`.
     - [src/routes/alerts.js](file:///e:/College_Documents/GITHUB/IT_infrastructure_management_software/backend-node/src/routes/alerts.js): `/alerts`.
     - [src/routes/activities.js](file:///e:/College_Documents/GITHUB/IT_infrastructure_management_software/backend-node/src/routes/activities.js): `/activities`.
     - [src/routes/commandCenter.js](file:///e:/College_Documents/GITHUB/IT_infrastructure_management_software/backend-node/src/routes/commandCenter.js): `/command-center/metrics`.
     - All mounted cleanly under `/api` and `/api/v1` in [src/app.js](file:///e:/College_Documents/GITHUB/IT_infrastructure_management_software/backend-node/src/app.js).
  5. Automated Test Suites:
     - [tests/telemetry.test.js](file:///e:/College_Documents/GITHUB/IT_infrastructure_management_software/backend-node/tests/telemetry.test.js) (6 tests).
     - [tests/sla.test.js](file:///e:/College_Documents/GITHUB/IT_infrastructure_management_software/backend-node/tests/sla.test.js) (6 tests).
     - [tests/postmortems.test.js](file:///e:/College_Documents/GITHUB/IT_infrastructure_management_software/backend-node/tests/postmortems.test.js) (5 tests).
     - [tests/cryptoAudits.test.js](file:///e:/College_Documents/GITHUB/IT_infrastructure_management_software/backend-node/tests/cryptoAudits.test.js) (4 tests).
     - [tests/vulnerabilities.test.js](file:///e:/College_Documents/GITHUB/IT_infrastructure_management_software/backend-node/tests/vulnerabilities.test.js) (6 tests).
     - [tests/alerts_activities.test.js](file:///e:/College_Documents/GITHUB/IT_infrastructure_management_software/backend-node/tests/alerts_activities.test.js) (5 tests).
  6. Verification Metrics: **91 passed, 91 total across 13 test suites (100% passing)**.
  7. Deep Analysis: Complete static analysis with zero syntax errors (`node --check`), zero unhandled rejections, and verified dual-route mounts for all 15 blueprints.

---

### Phase 6: Automated Test Parity, Dockerization & Staging Cutover
- **Objective**: Match 100% of the 149 pytest unit tests with Supertest/Jest, containerize, and validate.
- **Tasks**:
  1. Implement automated test suites covering all 149 unit test scenarios across authentication, RBAC, assets, incidents, financials, and ledger verification.
  2. Create production-ready `backend-node/Dockerfile` based on `node:20-alpine`.
  3. Verify frontend integration locally: Run Vite frontend connected to Node backend with zero modifications required in frontend API contracts.
  4. Prepare Docker Compose configuration update for the Oracle VPS.
  5. Perform cutover on the VPS only after test suite and end-to-end user flows pass cleanly.

---

## 4. Safety & Rollback Guarantee
- **Branch Isolation**: The current `master` branch and Python backend will remain untouched during the development of `feature/node-express-backend`.
- **Zero Production Downtime**: The Oracle Cloud VPS (`https://itims.kartik-mrk.me`) will continuously serve the existing Python backend until Phase 6 is signed off.
- **Instant Rollback**: If any unexpected issue arises post-cutover, rolling back simply requires switching the Docker container image tag back to `itims-backend-python`.

# Client Portal — Service Context for AI Agent

> **Read `PLANNING.md` first.** This file provides focused context for the Client Attendance Reporting Portal agent.

---

## 1. Role in the Stack

The Client Portal is a **read-only reporting application** for facility management clients. Companies that hire FM services need visibility into attendance compliance for personnel assigned to their locations. This is a **separate, simpler** React app from the main Web Portal.

### Upstream: Client users (browser) → NGINX → static files
### Downstream: Backend API (`/v1/*`) — read-only endpoints only

### You Do NOT:
- Modify employee data, payroll, or site configuration
- Access real-time location tracking (that's Ops Dashboard)
- Handle any write operations beyond login and notification ack

---

## 2. Tech Stack

Same as Web Portal but lighter:
```
React 18+ (Vite 5+) + TypeScript
├── React Router v6
├── TanStack Query v5 (server state)
├── Axios (HTTP client)
├── Recharts (attendance charts)
├── TanStack Table (data tables)
├── react-hook-form + zod (date filters)
├── date-fns (IST timezone handling)
├── Vitest + Playwright (testing)
└── CSS Modules
```

---

## 3. Project Structure

```
client-portal/
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── api/
│   │   ├── client.ts                    # Axios instance
│   │   ├── auth.api.ts                  # Login only (CLIENT role)
│   │   └── attendance.api.ts            # Read-only attendance data
│   ├── pages/
│   │   ├── LoginPage.tsx
│   │   ├── DashboardPage.tsx            # Attendance summary
│   │   ├── DailyReportPage.tsx          # Day-wise breakdown
│   │   ├── WeeklyReportPage.tsx
│   │   ├── MonthlyReportPage.tsx
│   │   └── ExportPage.tsx               # Download CSV/PDF reports
│   ├── components/
│   │   ├── layout/                      # Simple header/sidebar
│   │   ├── AttendanceTable.tsx          # Reusable attendance data table
│   │   ├── AttendanceSummaryCard.tsx    # Present/absent/late cards
│   │   └── DateRangePicker.tsx
│   └── types/
└── tests/
```

---

## 4. Key Features

### 4.1 Client Login
- Email/password login: `POST /v1/auth/login`
- JWT with `role: CLIENT` — backend restricts to read-only attendance endpoints
- Access only to sites assigned to this client (via `clientId` on sites table)

### 4.2 Attendance Dashboard
- **Summary cards**: Total employees assigned, present today, absent, late
- **Query**: `GET /v1/attendance/report?clientId={id}&period=daily&date=2026-03-30`
- Auto-refreshes every 5 minutes during business hours

### 4.3 Report Views
```
Daily Report:
  - Table: Employee Name | Site | Punch In | Punch Out | Hours | Status
  - Status: Present (green), Late (yellow), Absent (red), Early Departure (orange)
  - Early Departure: employee punched out before scheduled shift end time
  - Filter by site, date

Weekly Report:
  - Calendar grid: employees × days of week
  - Color-coded attendance status per day

Monthly Report:
  - Summary: Total working days, days present, days absent, late count, early departure count
  - Per-employee breakdown table
  - Chart: attendance trend over the month
```

### 4.4 Export
- `POST /v1/admin/export/attendance?clientId={id}&month=3&year=2026`
- Backend generates CSV/Excel and returns download URL
- PDF report with company branding (future enhancement)

---

## 5. API Endpoints Used

```
POST  /v1/auth/login                                    # Client login
POST  /v1/auth/refresh                                  # Token refresh
GET   /v1/attendance/report?clientId=&period=&date=     # Attendance data
GET   /v1/attendance/site/:siteId?startDate=&endDate=   # Site-specific
GET   /v1/sites?clientId=                               # Client's sites (read-only)
POST  /v1/admin/export/attendance                        # Generate export
```

### Backend Guard: `@Roles(Role.CLIENT)` — these endpoints filter by `clientId` automatically based on JWT.

---

## 6. Shared With Web Portal

- **api/client.ts** — Same Axios interceptor pattern for auth
- **types/** — Import from `packages/shared-types` (monorepo shared package)
- **components/** — Could share UI components via `packages/ui-components`, but keep it simple for V1. Duplicate if needed.

---

## 7. Design Notes

- **Clean, professional** — clients are external stakeholders
- **Print-friendly** — reports should look good when printed (CSS print styles)
- **Minimal navigation** — Dashboard, Daily, Weekly, Monthly, Export
- **Responsive** — works on tablet and desktop (clients check from various devices)
- **Branding** — show client company name and FM company logo

---

## 8. Decisions Impacting Other Services

| Decision | Impact |
|----------|--------|
| Client sees only their sites | Backend MUST filter by `clientId` from JWT |
| Auto-refresh every 5 min | Backend attendance report endpoint should be cacheable (Redis) |
| Export requests | Backend generates async, returns URL (may use BullMQ for large exports) |
| Read-only access | Backend CLIENT role guards must never allow write operations |

---

## 9. Deployment Must-Dos

The following concern was identified during tech stack analysis that should be addressed before production launch:
- **Content Security Policy (CSP)**: The portal lacks a defined CSP. Since it serves external stakeholders, XSS vulnerabilities pose a reputational risk. Define and enforce a strong CSP.

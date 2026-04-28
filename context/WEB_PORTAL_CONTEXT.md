# Web Portal — Service Context for AI Agent

> **Read `PLANNING.md` first.** This file provides focused context for the Web Portal (Admin/Ops/Payroll/SuperAdmin) agent.

---

## 1. Role in the Stack

The Web Portal is the **command center** for facility management operations. It serves four user personas through a single React application with role-based views:
1. **Admin** — Employee onboarding, site management, reports
2. **Supervisor (Ops Dashboard)** — Real-time employee tracking, geofence alerts, site monitoring
3. **Payroll Admin** — Salary structures, payroll runs, statutory compliance, bank files
4. **Super Admin** — Full system access, user/role management, audit logs, configuration

### Upstream: Users (browsers) → NGINX → served as static files
### Downstream: Backend API (`/v1/*`) for all data operations

### You Do NOT:
- Connect to PostgreSQL, Redis, or object storage directly
- Handle any real-time location data processing (that's backend)
- Generate payroll computations (backend BullMQ job handles it)

---

## 2. Tech Stack

```
React 18+ (Vite 5+)
├── TypeScript 5.x (strict mode)
├── React Router v6 (routing)
├── Zustand (client state management)
├── TanStack Query v5 (server state, caching, auto-refetch)
├── Axios (HTTP client with interceptors)
├── Leaflet / React-Leaflet (maps — live tracking + heatmaps)
├── Recharts (payroll charts, attendance analytics)
├── react-i18next (i18n — en, hi, mr for admin-facing labels) [*engineering extension — FM-OVERVIEW scopes i18n to V1 mobile modules only; included here for consistency*]
├── react-hook-form + zod (form validation)
├── date-fns (date manipulation, IST timezone handling)
├── TanStack Table (data tables with sorting, filtering, pagination)
├── Vitest (unit testing)
├── Playwright (E2E testing)
└── CSS Modules or Vanilla CSS (styling)
```

---

## 3. Project Structure

```
web-portal/
├── index.html
├── vite.config.ts
├── tsconfig.json
├── src/
│   ├── main.tsx                         # App entry
│   ├── App.tsx                          # Router + providers
│   ├── api/
│   │   ├── client.ts                    # Axios instance + interceptors
│   │   ├── auth.api.ts                  # Auth endpoints
│   │   ├── attendance.api.ts            # Attendance endpoints
│   │   ├── employees.api.ts             # Employee CRUD
│   │   ├── sites.api.ts                 # Site CRUD
│   │   ├── payroll.api.ts               # Payroll engine
│   │   ├── location.api.ts              # Live location + heatmap
│   │   ├── admin.api.ts                 # Super admin operations
│   │   └── notifications.api.ts         # Notification management
│   ├── hooks/                           # Custom hooks (useAuth, usePolling, etc.)
│   ├── stores/
│   │   ├── auth.store.ts                # Zustand: user, tokens, login state
│   │   └── ui.store.ts                  # Zustand: sidebar, theme, language
│   ├── types/
│   │   └── index.ts                     # Shared types (import from packages/shared-types)
│   ├── pages/
│   │   ├── auth/
│   │   │   └── LoginPage.tsx
│   │   ├── dashboard/
│   │   │   └── DashboardPage.tsx        # Role-specific dashboard
│   │   ├── employees/
│   │   │   ├── EmployeeListPage.tsx
│   │   │   ├── EmployeeDetailPage.tsx
│   │   │   └── EmployeeOnboardingPage.tsx
│   │   ├── sites/
│   │   │   ├── SiteListPage.tsx
│   │   │   ├── SiteDetailPage.tsx
│   │   │   └── GeofenceEditorPage.tsx   # Map-based geofence drawing
│   │   ├── attendance/
│   │   │   ├── AttendanceLogsPage.tsx
│   │   │   └── AttendanceReportPage.tsx # Daily/weekly/monthly
│   │   ├── ops/
│   │   │   ├── LiveTrackingPage.tsx     # Real-time map
│   │   │   ├── AlertsPage.tsx           # Geofence violations
│   │   │   ├── HeatmapPage.tsx          # Location heatmap
│   │   │   └── DeviceAuditPage.tsx      # Battery/signal/airplane
│   │   ├── payroll/
│   │   │   ├── SalaryStructuresPage.tsx
│   │   │   ├── PayrollRunPage.tsx       # Execute + approve payroll
│   │   │   ├── PayslipsPage.tsx
│   │   │   └── PayrollReportsPage.tsx   # PF/ESIC/TDS reports
│   │   ├── admin/
│   │   │   ├── UserManagementPage.tsx
│   │   │   ├── AuditLogPage.tsx
│   │   │   ├── SystemConfigPage.tsx
│   │   │   └── DataExportPage.tsx
│   │   └── site-updates/
│   │       └── SiteUpdatesPage.tsx
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Header.tsx
│   │   │   └── MainLayout.tsx
│   │   ├── common/
│   │   │   ├── DataTable.tsx            # Reusable table component
│   │   │   ├── StatusBadge.tsx
│   │   │   ├── ConfirmDialog.tsx
│   │   │   ├── FileUpload.tsx
│   │   │   └── LoadingSpinner.tsx
│   │   ├── maps/
│   │   │   ├── LiveMap.tsx              # Leaflet live employee map
│   │   │   ├── HeatmapLayer.tsx
│   │   │   └── GeofenceDrawer.tsx       # Polygon drawing tool
│   │   └── charts/
│   │       ├── AttendanceChart.tsx
│   │       └── PayrollSummaryChart.tsx
│   ├── utils/
│   │   ├── format.ts                    # Date, currency, number formatters
│   │   ├── validators.ts               # Zod schemas
│   │   └── constants.ts                # Error codes, roles, etc.
│   ├── i18n/
│   │   ├── en.json
│   │   ├── hi.json
│   │   └── mr.json
│   └── styles/
│       ├── global.css
│       └── variables.css                # Design tokens
├── tests/
│   ├── unit/                            # Vitest
│   └── e2e/                             # Playwright
└── public/
```

---

## 4. Key Features & Implementation Guide

### 4.1 Authentication (Email/Password for Web)
```typescript
// stores/auth.store.ts
const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null, // In-memory ONLY — never localStorage
  
  login: async (email, password) => {
    const res = await authApi.login({ email, password });
    // Refresh token set as httpOnly cookie by backend
    set({ user: res.data.user, accessToken: res.data.accessToken });
  },
  
  refreshToken: async () => {
    // Calls /v1/auth/refresh — cookie sent automatically
    const res = await authApi.refresh();
    set({ accessToken: res.data.accessToken });
  },
}));
```

### 4.2 Role-Based Routing
```typescript
// App.tsx
<Routes>
  <Route path="/login" element={<LoginPage />} />
  <Route element={<ProtectedRoute allowedRoles={['ADMIN', 'SUPERVISOR', 'SUPER_ADMIN']} />}>
    <Route path="/dashboard" element={<DashboardPage />} />
    <Route path="/employees/*" element={<EmployeeRoutes />} />
    <Route path="/sites/*" element={<SiteRoutes />} />
    <Route path="/attendance/*" element={<AttendanceRoutes />} />
    <Route path="/site-updates" element={<SiteUpdatesPage />} />
  </Route>
  <Route element={<ProtectedRoute allowedRoles={['SUPERVISOR', 'SUPER_ADMIN']} />}>
    <Route path="/ops/*" element={<OpsRoutes />} />
  </Route>
  <Route element={<ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']} />}>
    <Route path="/payroll/*" element={<PayrollRoutes />} />
  </Route>
  <Route element={<ProtectedRoute allowedRoles={['SUPER_ADMIN']} />}>
    <Route path="/admin/*" element={<AdminRoutes />} />
  </Route>
</Routes>
```

### 4.3 Ops Dashboard — Live Employee Tracking
```typescript
// pages/ops/LiveTrackingPage.tsx
// Poll GET /v1/location/live?siteId=xyz every 10 seconds
const { data: liveLocations } = useQuery({
  queryKey: ['live-locations', siteId],
  queryFn: () => locationApi.getLiveLocations(siteId),
  refetchInterval: 10_000, // 10 seconds
});

// Render on Leaflet map with employee markers
// Color-code: green = on-site, red = outside geofence, grey = offline (no update in 3 min)
// Show battery/signal indicators on marker popups
// Geofence polygon overlay on the map
```

### 4.4 Payroll Run Flow (Web-Side)
```
1. Admin navigates to Payroll → New Run
2. Selects Month/Year → POST /v1/payroll/run { month, year }
3. Backend returns { jobId } immediately
4. UI polls GET /v1/payroll/run/{jobId}/status every 3 seconds
5. Shows progress: "Processing employee 45 of 200..."
6. When status = PENDING_APPROVAL:
   - Show summary: total gross, total deductions, net payable
   - Show payslip table with per-employee breakdown
   - Admin reviews → clicks Approve or Reject
7. POST /v1/payroll/run/{id}/approve → status = APPROVED
8. Download bank file: GET /v1/payroll/run/{id}/bank-file
```

### 4.5 Employee Onboarding
```
1. Fill form: name, DOB, mobile, Aadhaar, PAN (masked input)
2. Upload documents: Aadhaar, PAN card, photo, ration card, police verification
   - Each: presigned URL → upload to R2/S3 → confirm
3. Assign to site + shift
4. Set salary structure (basic, HRA, components)
5. POST /v1/employees → creates user + employee + salary structure
6. Employee receives OTP to set up mobile app
```

### 4.6 Geofence Editor
- **Leaflet Draw** plugin for polygon drawing on map
- Admin draws polygon around site perimeter
- Submit as GeoJSON: `POST /v1/sites/{id}/geofence`
- Fallback: simple circle with radius input for basic sites

### 4.7 Heatmap Visualization
- Query: `GET /v1/location/heatmap?siteId=xyz&date=2026-03-30`
- Returns GeoJSON with intensity values
- Render using `leaflet.heat` plugin
- Date picker for historical heatmaps

---

## 5. API Client Setup

```typescript
// api/client.ts
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL, // https://api.fm.example.com/v1
  withCredentials: true, // Send httpOnly cookies for refresh
});

// Request interceptor — inject access token
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  config.headers['Accept-Language'] = useUIStore.getState().language;
  return config;
});

// Response interceptor — handle token refresh on 401
apiClient.interceptors.response.use(
  (res) => res.data, // Unwrap to { success, data, meta, error }
  async (error) => {
    if (error.response?.status === 401 && !error.config._retry) {
      error.config._retry = true;
      await useAuthStore.getState().refreshToken();
      return apiClient(error.config);
    }
    return Promise.reject(error.response?.data?.error || error);
  }
);
```

---

## 6. Design System

- **Typography**: Inter (Google Fonts) — clean, professional
- **Color palette**: Dark sidebar + light content area. Accent color configurable per org
- **Responsive**: Desktop-first (1280px+), tablet-friendly (768px+). Not optimized for phone
- **Data tables**: Sortable columns, filterable, server-side pagination
- **Maps**: Leaflet (free, no API key) with OpenStreetMap tiles
- **Charts**: Recharts for attendance trends, payroll breakdowns
- **Status indicators**: Color-coded badges (active/inactive, approved/pending/rejected)

---

## 7. Testing

| Type | Tool | Scope |
|------|------|-------|
| Unit | Vitest | 70%+ on components, hooks, utils |
| Integration | Vitest + MSW | API interactions |
| E2E | Playwright | Login → Navigate → Key workflows |

### Critical E2E scenarios:
1. Login → role-based dashboard routing
2. Employee onboarding → document upload → site assignment
3. Live tracking page → markers update every poll
4. Payroll run → progress polling → approve → download bank file
5. Geofence editor → draw polygon → save → verify on map

---

## 8. Decisions Impacting Other Services

| Decision | Impact |
|----------|--------|
| 10s polling for live tracking | Backend `/v1/location/live` must be <200ms, Redis-backed |
| Payroll status polling (3s) | Backend must support lightweight status endpoint |
| Geofence as GeoJSON | Backend must parse and store as PostGIS geography |
| Role-based routing | Backend guards must match exact role definitions |
| httpOnly cookie refresh | Backend must support `Set-Cookie` on login and refresh |
| CSV/Excel export | Backend generates file, returns download URL |

---

## 9. Deployment Must-Dos

The following concerns were identified during tech stack analysis that should be addressed before or during production launch:
- **Content Security Policy (CSP)**: The portal lacks a defined CSP, increasing the risk of XSS attacks (e.g., from employee-submitted site update text). Define and enforce a strong CSP.
- **Map Rendering Lag**: Loading 3,000 raw markers on the live map will freeze the browser. Implement marker clustering (e.g., `leaflet.markercluster`) before scaling.

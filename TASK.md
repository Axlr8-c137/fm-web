# FM Web Portal - Task List

## Phase 1: Foundation (Current)
- [x] Bootstrap Vite project with React + TS
- [x] Install core dependencies
- [x] Set up directory structure
- [x] Initialize design system and global styles
- [x] Create Axios client and interceptors
- [x] Set up Auth store (Zustand)
- [x] **MUI Integration**: Setup Material UI and Material 3 Theme (`ThemeProvider`)
    - [x] Create `ThemeStore` (Zustand) for managing `mode: 'light' | 'dark'`
    - [x] Configure dual color palettes (Light vs Dark) using Material 3 guidelines
    - [x] Set up global typography (Roboto/Inter)
    - [x] Configure component overrides for M3 look and feel

## Phase 2: Authentication & Layout (MUI/M3)
- [x] Implement Login page (Email/Password + OTP Support)
- [x] Create Main Layout using MUI Components
    - [x] `MuiAppBar` for Header with User Profile and **Theme Mode Toggle**
    - [x] `MuiDrawer` for Collapsible Sidebar with Role-based Visibility
- [x] Set up Protected Routes with MUI Loading States
- [x] Implement Sidebar navigation using MUI Icons (`@mui/icons-material`)
- [x] Handle Session Refresh (`POST /v1/auth/refresh`)
- [x] Create Reusable **Advanced Data Table** (MUI X-Data-Grid or Custom MUI Table)
    - [x] Integrated Sorting (`TableSortLabel`)
    - [x] Global Search/Filtering
    - [x] Multi-row selection (MUI Checkboxes)
    - [x] Pagination controls (`TablePagination`)
    - [x] Dense/Standard padding toggle

## Phase 3: Core Modules (MUI/M3)
- [x] Employee Listing and Search
    - [x] Advanced MUI Data Table implementation (`GET /v1/employees`)
    - [x] Search by name/role with MUI `TextField` and icons
- [x] Site Listing and Details
    - [x] MUI Card-based listing or Data Table (`GET /v1/sites`)
    - [x] Detail view with Geofence visualization and MUI Tabs (`GET /v1/sites/{id}`)
- [x] Attendance Logs table
    - [x] Advanced MUI Data Table with Date Range filters (`GET /v1/attendance/logs`)
    - [x] Export selected rows to CSV (`POST /v1/admin/export/ATTENDANCE`)
- [x] Employee Onboarding form (MUI Stepper)
    - [x] Step 1: Basic Info (MUI Forms + Validation)
    - [x] Step 2: Document Upload (MUI Upload buttons + Progress)
    - [x] Step 3: Multi-pose Face Registration (Camera UI with MUI overlays)

## Phase 4: Operations & Maps
- [ ] Live Tracking Map (Leaflet + MUI Overlays)
    - [ ] Real-time marker updates (`GET /v1/location/live/{siteId}`)
- [ ] Geofence Editor (MUI Sidebar for geometry controls)
    - [ ] Drawing tools for Circle/Polygon (`PUT /v1/sites/{id}/geofence`)
- [ ] Heatmap Visualization
    - [ ] Intensity map based on attendance density (`GET /v1/location/heatmap/{siteId}`)
- [ ] Geofence Alerts Monitor (MUI Snackbar/Alerts) (`GET /v1/location/alerts`)

## Phase 5: Payroll Engine (MUI/M3)
- [ ] Salary Structure management
    - [ ] Setup/Update structure with MUI Dialogs and Fields
- [ ] Payroll Run wizard (MUI Stepper)
    - [ ] Table of eligible employees with MUI selection
    - [ ] Approval workflow with MUI Action Buttons
- [ ] Payslip generation and reports
    - [ ] Advanced MUI Data Table for payroll history (`GET /v1/payroll/run/{id}/payslips`)

## Phase 6: Admin & Polish (MUI/M3)
- [ ] User Management (`GET /v1/admin/users`)
    - [ ] Advanced MUI Data Table for user administration
- [ ] Audit Logs (`GET /v1/admin/audit-logs`)
    - [ ] Advanced MUI Data Table for log inspection
- [ ] Dashboard Statistics (MUI Grid + Recharts + MUI Cards)
- [ ] i18n Implementation (en, hi, mr) (`PATCH /v1/employees/me/language`)
- [ ] Testing (Unit & E2E)
- [ ] Final UI/UX Polish (Animations, Transitions, and Hover effects)




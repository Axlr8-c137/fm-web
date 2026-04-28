# FM Web Portal - Project Planning

## Project Vision
The FM Web Portal is the central management interface for the Facility Management Application. It provides tools for employee onboarding, site management, real-time operations monitoring, and payroll processing.

## Tech Stack
- **Framework**: React 18+ (Vite)
- **Language**: TypeScript 5.x
- **State Management**: Zustand (Client) & TanStack Query v5 (Server)
- **Routing**: React Router v6
- **API**: Axios with Interceptors
- **Maps**: Leaflet / React-Leaflet
- **Charts**: Recharts
- **Styling**: Material UI (MUI) with Material 3 Design Patterns
- **Theming**: Dynamic Dark/Light mode support via MUI ThemeProvider
- **Validation**: React Hook Form + Zod

## Key Modules
1. **Authentication**: Role-based access control (Admin, Supervisor, Payroll, Super Admin).
2. **Dashboard**: Role-specific overview and analytics.
3. **Employee Management**: Onboarding, documentation, and profiles.
4. **Site Management**: Site details and Geofence editor.
5. **Attendance**: Logs and reporting.
6. **Operations**: Live employee tracking, geofence alerts, and heatmaps.
7. **Payroll**: Salary structures, payroll runs, and statutory reporting.
8. **Admin**: User management, audit logs, and system configuration.

## Core Architectural Decisions
- **In-Memory Access Tokens**: For enhanced security, access tokens are kept in memory.
- **Refresh Tokens**: Stored in httpOnly cookies.
- **10s Live Polling**: Dashboard updates every 10 seconds for real-time tracking.
- **Shared Types**: DTOs should align with the backend Java models.
- **Dynamic Theming**: Light/Dark mode state managed via Zustand and persisted in LocalStorage.

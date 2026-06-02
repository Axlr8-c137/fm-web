# FM Web Portal

The FM Web Portal is the central management interface for a comprehensive Facility Management Application. It provides a robust, real-time environment for managing operations, personnel, and compliance within the facility management sector.

## 🚀 Overview

This portal serves as the administrative hub for:
- **Operations Monitoring**: Real-time tracking and geofencing alerts for field employees.
- **Employee Lifecycle Management**: Seamless onboarding from documentation (Aadhaar, PAN, etc.) to payroll registration.
- **Attendance & Site Reporting**: Precise tracking via geofencing and facial recognition (integrated with the mobile app).
- **Payroll & Compliance**: Automated payroll processing with Indian statutory compliance (PF, ESIC, TDS, PT).
- **Site Management**: Granular control over client sites and geofence configurations.

## 🛠 Tech Stack

- **Frontend**: React 19 + TypeScript + Vite
- **UI Framework**: Material UI (MUI) with Material 3 Design Patterns
- **State Management**: Zustand (Client) & TanStack Query v5 (Server)
- **Routing**: React Router v7
- **Data Handling**: Axios with interceptors for auth & error handling
- **Visualization**: Leaflet/React-Leaflet for maps, Recharts for analytics
- **Forms & Validation**: React Hook Form + Zod
- **I18n**: i18next for multi-language support (English, Hindi, Marathi)

## 📁 Project Structure

```text
src/
├── api/          # Axios client and service-specific API calls
├── assets/       # Static assets (images, icons)
├── components/   # Reusable UI components (common, layout, auth, etc.)
├── hooks/        # Custom React hooks
├── i18n/         # Internationalization configurations
├── pages/        # Application pages/views grouped by module
├── stores/       # Zustand state stores
├── styles/       # Global styles and MUI theme configuration
├── types/        # TypeScript interfaces and types
└── utils/        # Helper functions and utilities
```

## ⚙️ Getting Started

### Prerequisites
- Node.js (Latest LTS recommended)
- npm or yarn

### Installation
1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```

### Development
Start the development server:
```bash
npm run dev
```
The application will be available at `http://localhost:5173`.

### Environment Configuration
The application uses Vite environment variables. Ensure the `VITE_API_BASE_URL` is correctly set in your `.env` files.
- `.env.development`: Local development API
- `.env.production`: Production API

### Build
Generate a production build:
```bash
npm run build
```
The output will be in the `dist` directory.

## 🛡 Security & Authentication
- **Role-Based Access Control (RBAC)**: Supports Admin, Super Admin, Supervisor, and Payroll Admin roles.
- **In-Memory Tokens**: Access tokens are kept in memory for enhanced security.
- **Session Management**: Secure refresh token handling via httpOnly cookies.

## 🗺 Project Status & Roadmap
The project is currently in active development.

### ✅ Completed
- [x] Foundation & Architecture (React 19, MUI Material 3, Zustand)
- [x] Auth & Session Management
- [x] Employee Listing & Advanced Search
- [x] Site Listing & Detailed View
- [x] Attendance Logs with Advanced Filtering
- [x] Multi-step Employee Onboarding (Basic Info, Documents, Facial Registration)

### 🚧 In Progress / Planned
- [ ] **Operations**: Live employee tracking on maps (Leaflet integration).
- [ ] **Geofencing**: Interactive geofence editor for site perimeters.
- [ ] **Payroll**: Full payroll processing engine and salary management.
- [ ] **Analytics**: Dashboard with real-time stats and heatmaps.
- [ ] **I18n**: Full implementation of Hindi and Marathi locales.

## 📄 License
[Private / Proprietary]

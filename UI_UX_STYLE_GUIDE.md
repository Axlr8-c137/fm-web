# Facility Management (FM) UI/UX Style Guide

This document outlines the visual aesthetics and user experience patterns used in the FM Mobile application, intended for adoption in the web project to maintain brand consistency.

## 1. Design Philosophy
- **Modern Utility**: A clean, high-performance look focused on clarity and ease of use in the field.
- **Design System**: Built on **Material 3 (M3)** standards, leveraging components like cards, FABs, and bottom sheets.
- **Responsive**: Designed for high-density information displays while maintaining accessibility.

## 2. Color Palette

### Primary Colors
- **Brand Primary**: `Colors.blueAccent` (#448AFF) - Used for AppBars, primary buttons, active states, and progress indicators.
- **Selection Highlight**: `blueAccent.withOpacity(0.1)` or `0.2` - Used for list item backgrounds and subtle highlights.

### Semantic Colors (Status)
- **Success**: `Colors.green` (#4CAF50) - Successful attendance, completed tasks.
- **Error/Danger**: `Colors.redAccent` (#FF5252) or `Colors.red` - Geofence failures, missing documentation, error snackbars.
- **Warning/Pending**: `Colors.orangeAccent` (#FFAB40) - Offline sync status, pending approvals.
- **Info**: `Colors.blue` (#2196F3) - General information.

### Neutral Colors
- **Text (Primary)**: `Colors.black87` (Light Mode) / `Colors.white` (Dark Mode).
- **Text (Secondary)**: `Colors.grey.shade600` / `Colors.grey.shade500`.
- **Dividers**: `Colors.grey.shade200` (Light) / `Colors.white10` (Dark).

## 3. Theming

| Element | Light Mode | Dark Mode (GitHub-inspired) |
| :--- | :--- | :--- |
| **Scaffold Background** | `Colors.white` (#FFFFFF) | `#0D1117` |
| **Card / Surface** | `Colors.grey.shade100` (#F5F5F5) | `#161B22` |
| **AppBar Background** | `Colors.blueAccent` | `#161B22` |
| **AppBar Foreground** | `Colors.white` | `Colors.white` |
| **Bottom Nav / Sidebar**| `Theme.cardColor` | `#161B22` |

## 4. UI Components & Patterns

### Layout & Spacing
- **Standard Padding**: `16.0` pixels for screen containers.
- **Card-Based UI**: Data is grouped into cards with subtle shadows (`boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.1), blurRadius: 4)]`).
- **Input Fields**: 
  - `OutlineInputBorder` with `blueAccent` on focus.
  - Prefix icons (e.g., `Icons.person`, `Icons.lock`) are common.

### Navigation
- **Mobile**: `BottomNavigationBar` with fixed labels.
- **Web Adaptation**: Recommend a **Left Sidebar** for the web dashboard, using the same `blueAccent` for active states and `grey` for inactive states.

### Interactive Elements
- **Buttons**:
  - Primary: Solid `blueAccent` background with `white` text.
  - Secondary/Outlined: `blueAccent` border and text.
- **Feedback**: 
  - `CircularProgressIndicator` always uses `blueAccent`.
  - Snackbars use semantic background colors (Green/RedAccent).

## 5. Visual Assets
- **Icons**: Standard Material Icons. Heavy use of `blueAccent` for iconography to drive brand recognition.
- **Animations**: Subtle "Scanning" animations are used during Face Recognition (Pulse/Line sweeps).

## 6. Typography
- **Primary Font**: System default (Roboto/San Francisco).
- **Title**: Medium/Bold weight for section headers.
- **Body**: Standard weight for data entries.
- **Captions**: Smaller, grey-colored text for timestamps and metadata.

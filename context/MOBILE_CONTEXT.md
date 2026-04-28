# Android Mobile App — Service Context for AI Agent

> **Read `PLANNING.md` first.** This file provides focused context for the Android Mobile App agent.

---

## 1. Role in the Stack

The Android app is the **frontline tool** for field employees. It handles attendance (geofenced punch in/out with facial recognition), shift viewing, site updates, and push notifications. It must work reliably in **low-connectivity environments** and conserve battery.

### Upstream: Push Notifications (FCM), Play Store
### Downstream: Backend API (`/v1/*`), Cloudflare R2/S3 (media upload), Firebase (FCM token)

### You Do NOT:
- Connect to PostgreSQL or Redis directly
- Store business logic locally
- Make decisions about payroll, reports, or admin operations

---

## 2. Tech Stack

```
Kotlin (latest stable)
├── Jetpack Compose (UI) + Material 3
├── Hilt (DI) + Navigation Compose
├── Retrofit 2 + OkHttp (Networking)
├── Kotlin Coroutines + Flow (Async)
├── Room (Offline cache) + DataStore (Preferences)
├── WorkManager (Background sync)
├── Google Play Services Location (GPS)
├── CameraX (Face capture)
├── Coil (Image loading)
└── JUnit 5 + MockK + Compose Testing
```

**Min SDK**: 24 (Android 7.0) | **Target SDK**: 34 (Android 14)

---

## 3. Project Structure

```
app/src/main/java/com/fm/employee/
├── FMApplication.kt                    # Hilt entry
├── MainActivity.kt                     # Single Activity, Compose host
├── navigation/                         # AppNavHost, Routes
├── core/
│   ├── network/                        # ApiService, AuthInterceptor, TokenRefreshAuthenticator
│   ├── database/                       # Room DB, DAOs, entities (offline cache)
│   ├── di/                             # Hilt modules
│   ├── auth/                           # TokenManager (EncryptedDataStore), SessionManager
│   └── location/                       # LocationService (foreground), GeofenceHelper
├── features/
│   ├── auth/                           # Login, OTP screens + ViewModel
│   ├── attendance/                     # Punch in/out + history + ViewModel
│   ├── shifts/                         # Shift schedule + task view + ViewModel
│   ├── site-updates/                   # Create/list updates + ViewModel
│   ├── profile/                        # Employee ID card, language settings
│   └── notifications/                  # Notification list + ViewModel
├── ui/theme/                           # Material 3 theme
└── ui/components/                      # Reusable composables

res/
├── values/strings.xml                  # English (default)
├── values-hi/strings.xml               # Hindi
└── values-mr/strings.xml               # Marathi
```

---

## 4. Key Feature Implementations

### 4.1 OTP Login
1. `POST /v1/auth/otp/request` with phone → show 60s countdown
2. `POST /v1/auth/otp/verify` with OTP → receive JWT tokens
3. Store tokens in **EncryptedSharedPreferences** (AndroidX Security)
4. Register FCM token: `POST /v1/notifications/register-device`

### 4.2 Attendance Punch (Critical Path)
```
1. Get GPS location (HIGH_ACCURACY for punch)
2. Capture face via CameraX
3. Upload face: presigned URL → direct to R2/S3 → confirm
4. POST /v1/attendance/punch { lat, lng, accuracy, faceImageUrl, timestamp, deviceInfo }
5. Handle responses:
   - success → show confirmation
   - GEOFENCE_VIOLATION → show map overlay with site boundary
   - FACE_MISMATCH → prompt retry
   - DUPLICATE_PUNCH → show already punched
```

**Offline**: Save to Room pending table → sync via WorkManager when online.  
**Backend MUST handle idempotent submissions** (timestamp from mobile, not server).

### 4.3 Location Tracking
- **Foreground Service** with persistent notification (Android 14+ requires `FOREGROUND_SERVICE_LOCATION`)
- Send `POST /v1/location/update` every **30 seconds** during shift
- Payload: `{ lat, lng, accuracy, battery, signal, airplaneMode }`
- Use `PRIORITY_BALANCED_POWER_ACCURACY` for continuous tracking (battery saving)
- Switch to `PRIORITY_HIGH_ACCURACY` only during punch in/out
- **Start** on successful punch-in, **stop** on punch-out
- Buffer in Room if offline, batch-send later

### 4.4 Shifts & Task View
> **Note**: FM-OVERVIEW.md lists "shift schedules" and "task view" as separate features for mobile. In V1, both are served by the Shifts module — shift assignments act as the employee's task list for the day.

- **Schedule screen**: `GET /v1/shifts/schedule?employeeId={id}&startDate=&endDate=`
  - Shows upcoming shifts assigned to the employee (today, this week)
  - Each shift displays: site name, shift name, start/end time, date
- **Task view**: Shift assignments serve as the employee's daily task list
  - Today's assigned shift(s) shown prominently on the home/dashboard screen
  - Includes site name, reporting time, and current status (upcoming / active / completed)
- **Data source**: `ShiftAssignment` entity (employee ↔ shift ↔ date) from the backend
- **Offline**: Cached in Room (`CachedShift` entity) for offline viewing

### 4.5 Site Updates
- Text + photos (max 5, compressed to 1280px/80%) + video (max 1, 30s)
- Upload each file via presigned URL flow
- Submit: `POST /v1/site-updates { text, mediaUrls[], siteId }`

### 4.6 Employee ID Card
- Offline-accessible (cached in Room)
- Shows: photo, name, employee ID, site, QR code (encodes employee UUID)

### 4.7 Multi-Language
- `strings.xml` per locale: `en`, `hi`, `mr`
- `AppCompatDelegate.setApplicationLocales()` (Android 13+)
- Fallback: `Configuration.setLocale()` in `attachBaseContext()` for older versions
- **Never hardcode strings**

---

## 5. Network Layer

### API Response Wrapper (matches PLANNING.md envelope)
```kotlin
data class ApiResponse<T>(
    val success: Boolean,
    val data: T?,
    val meta: PaginationMeta?,
    val error: ApiError?
)

data class ApiError(
    val code: String,      // Maps to PLANNING.md error codes
    val message: String,
    val details: Map<String, Any>?
)
```

### Auth Interceptor: Injects `Authorization: Bearer <token>` + `Accept-Language` header
### Token Refresh: On 401 → call `/v1/auth/refresh` → retry. On refresh failure → logout.

---

## 6. Offline-First Strategy

```
Room entities: CachedProfile, PendingPunch, PendingLocationUpdate, PendingSiteUpdate, CachedShift

IF network available → send to API → update cache
IF unavailable → save to pending table → show "pending sync"

WorkManager (periodic, 15 min, requires-network):
  → Query pending items → send oldest first → delete on success
  → Retry with exponential backoff → flag after 5 failures
```

---

## 7. Permissions

```xml
INTERNET, ACCESS_FINE_LOCATION, ACCESS_COARSE_LOCATION, ACCESS_BACKGROUND_LOCATION,
FOREGROUND_SERVICE, FOREGROUND_SERVICE_LOCATION, CAMERA, POST_NOTIFICATIONS (13+),
READ_MEDIA_IMAGES (13+), READ_EXTERNAL_STORAGE (max 32)
```

**Flow**: Location + Camera on first login → Background Location after first punch → Notifications + Gallery on demand. Educational UI on denial.

---

## 8. Security

- **Certificate Pinning** on API domain (OkHttp `CertificatePinner`)
- **EncryptedSharedPreferences** for token storage
- **ProGuard/R8** enabled for release builds
- **Root detection** warning (attendance integrity)
- **FLAG_SECURE** on sensitive screens
- **No Log.d/Log.v** in release builds

---

## 9. Testing

| Type | Tool | Scope |
|------|------|-------|
| Unit (ViewModels) | JUnit 5 + MockK | 70%+ |
| Unit (Repository) | JUnit 5 + MockK | 80%+ |
| UI | Compose Testing | Critical screens |
| Integration | MockWebServer | API layer |
| E2E | Espresso | Login → Punch → Site Update |

---

## 10. Decisions Impacting Other Services

| Decision | Impact |
|----------|--------|
| Offline punch queue | Backend MUST handle idempotent submissions |
| Location every 30s | Backend handles ~100 req/s sustained at scale |
| Face image upload | Backend extracts embedding + compares asynchronously |
| Device info in punch | Backend stores as JSON in `device_info` column |
| Accept-Language header | Backend uses for SMS/email localization |
| FCM token per device | Backend stores per user-device pair, handles refresh |

---

## 11. Deployment Must-Dos

The following concern was identified during tech stack analysis that should be addressed prior to wide release:
- **OEM Background Service Kills**: Chinese OEMs (Xiaomi, Oppo, Vivo) aggressively kill background tracking, which breaks the 30-second location updates. The app must implement OEM-specific intent launches guiding users to disable battery optimization.

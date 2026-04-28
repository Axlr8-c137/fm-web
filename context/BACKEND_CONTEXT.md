# Backend API — Service Context for AI Agent

> **Read `PLANNING.md` first.** This file provides focused context for the Spring Boot Backend API agent.

---

## 1. Role in the Stack

The Backend API is the **central nervous system** of the FM platform. Every client (Mobile, Web Portal, Client Portal) communicates exclusively through this API. No client should ever connect directly to the database, Redis, or object storage.

### Upstream (Who calls you)
- **Flutter Mobile App** — Attendance punches, location updates, site updates, employee profile
- **Web Portal** — Payroll management, ops dashboard data, admin CRUD, employee onboarding
- **Client Portal** — Read-only attendance reports for client-assigned personnel
- **NGINX** — Reverse proxy, SSL termination, routes to API

### Downstream (What you call)
- **PostgreSQL + PostGIS** — Primary data store, geospatial queries
- **Redis** — Caching (sessions, employee status, live location)
- **Spring Scheduler / @Async** — Payroll processing, heatmap aggregation, media thumbnail generation, data retention cleanup
- **Cloudflare R2 / AWS S3** — Presigned URL generation for media uploads
- **Firebase Cloud Messaging** — Push notifications to mobile devices
- **SMTP / SMS Gateway** — OTP delivery, payroll notifications

---

## 2. Tech Stack

```
Spring Boot 3.4.0 (Java 17 LTS)
├── Maven (build & dependency management)
├── Spring Data JPA + Hibernate Spatial (PostgreSQL + PostGIS)
├── Jakarta Bean Validation (DTO validation)
├── Spring Security + JWT (auth strategy)
├── Spring Scheduler + @Async (background jobs)
├── Spring Data Redis (caching, live location)
├── Spring Boot Starter Web (REST controllers)
├── Lombok (boilerplate reduction)
├── Springdoc OpenAPI (auto Swagger docs)
├── Thumbnailator (image processing)
├── SLF4J + Logback (structured logging)
└── JUnit 5 + Mockito + Spring Boot Test (testing)
```

---

## 3. Module Architecture

```
src/main/java/com/fm/
├── FmApplication.java                    # @SpringBootApplication entry point
├── config/                               # Configuration classes
│   ├── SecurityConfig.java               # Spring Security filter chain, JWT config
│   ├── RedisConfig.java                  # Redis connection & template
│   ├── AsyncConfig.java                  # @Async thread pool configuration
│   ├── CorsConfig.java                   # CORS policy
│   └── OpenApiConfig.java               # Swagger/OpenAPI setup
├── common/                               # Shared utilities
│   ├── annotation/                       # @CurrentUser, @ApiPaginated custom annotations
│   ├── security/                         # JwtTokenProvider, JwtAuthenticationFilter
│   ├── interceptor/                      # ResponseEnvelopeInterceptor, LoggingInterceptor
│   ├── exception/                        # GlobalExceptionHandler (@ControllerAdvice)
│   ├── dto/                              # PaginationDto, ApiResponseDto, ApiErrorDto
│   └── constants/                        # ErrorCodes, Roles enum
├── modules/
│   ├── auth/                             # OTP login, JWT issue/refresh, password auth
│   │   ├── AuthController.java
│   │   ├── AuthService.java
│   │   ├── dto/
│   │   │   ├── OtpRequestDto.java
│   │   │   ├── OtpVerifyDto.java
│   │   │   └── LoginDto.java
│   │   └── entity/
│   │       └── RefreshToken.java
│   ├── users/                            # User CRUD, role management
│   ├── employees/                        # Employee profiles, onboarding, documents
│   ├── sites/                            # Site CRUD, geofence polygon management
│   ├── attendance/                       # Punch in/out, attendance logs, reports
│   ├── location/                         # Live location ingestion, heatmap queries
│   ├── siteupdates/                      # Field employee site status reports
│   ├── shifts/                           # Shift schedule management
│   ├── payroll/                          # Payroll engine (PF, ESIC, TDS, PT)
│   ├── notifications/                    # FCM push, email, SMS
│   ├── media/                            # Presigned URL generation, thumbnail jobs
│   └── admin/                            # Super admin operations, audit log
├── scheduler/                            # @Scheduled job classes
│   ├── PayrollJobScheduler.java
│   ├── HeatmapAggregationJob.java
│   ├── RetentionCleanupJob.java
│   └── ThumbnailProcessorJob.java
└── src/test/java/com/fm/
    ├── unit/                             # Unit tests (per module)
    ├── integration/                      # MockMvc endpoint tests
    └── e2e/                              # Full flow tests (Testcontainers)

src/main/resources/
├── application.yml                       # Main config
├── application-dev.yml                   # Dev profile
├── application-prod.yml                  # Production profile
└── db/migration/                         # Flyway migration SQL files
```

---

## 4. Database Schema (JPA Entities)

### Enums

```java
public enum Role {
    EMPLOYEE, SUPERVISOR, ADMIN, SUPER_ADMIN, CLIENT
}

public enum PunchType {
    IN, OUT
}

public enum PayrollStatus {
    DRAFT, PROCESSING, PENDING_APPROVAL, APPROVED, REJECTED, DISBURSED
}

public enum DocumentType {
    AADHAAR, PAN, RATION_CARD, POLICE_VERIFICATION,
    PF_DOCUMENT, ESIC_DOCUMENT, PHOTO
}
```

### Key Entities (JPA Annotations)

> Full entity classes will use `@Entity`, `@Table`, `@Id`, `@GeneratedValue(strategy = GenerationType.UUID)`, Lombok `@Data`, `@Builder`, etc. Below is the logical schema:

```
organizations     → id (PK, UUID), name, createdAt, updatedAt
users             → id (PK, UUID), phone?, email?, passwordHash?, role, isActive, preferredLang, organizationId (FK)
employees         → id (PK, UUID), userId (FK, unique), fullName, dateOfBirth?, aadhaarEncrypted?, panEncrypted?, faceEmbedding (float[]), siteId? (FK), organizationId (FK)
sites             → id (PK, UUID), name, address?, geofenceRadius?, latitude?, longitude?, isActive, clientId? (FK), organizationId (FK)
                    // PostGIS: geofence column as geography(Polygon, 4326) — managed via native SQL
clients           → id (PK, UUID), name, contactEmail?, contactPhone?, organizationId (FK)
attendance_logs   → id (PK, UUID), employeeId (FK), punchType, punchTime, lat, lng, accuracy?, faceMatchScore?, isInsideGeofence, deviceInfo (JSONB), siteId (FK)
location_history  → id (PK, UUID), employeeId (FK), lat, lng, accuracy?, battery?, signal?, airplaneMode, recordedAt
site_updates      → id (PK, UUID), employeeId (FK), siteId (FK), text?, mediaUrls (text[]), recordedAt
shifts            → id (PK, UUID), siteId (FK), name, startTime (HH:mm), endTime, isActive
shift_assignments → id (PK, UUID), employeeId (FK), shiftId (FK), date (DATE), UNIQUE(employeeId, date)
employee_documents → id (PK, UUID), employeeId (FK), type (DocumentType), fileUrl, isVerified, verifiedBy?, verifiedAt?
salary_structures → id (PK, UUID), employeeId (FK, unique), basic, hra, conveyance?, special?, grossSalary, pfEmployee, pfEmployer, esicEmployee?, esicEmployer?, ptAmount?
payroll_runs      → id (PK, UUID), month, year, status (PayrollStatus), processedBy?, approvedBy?, bankFileUrl?, totalGross?, totalNet?, totalPf?, totalEsic?, totalTds?, organizationId (FK), UNIQUE(month, year, organizationId)
payslips          → id (PK, UUID), payrollRunId (FK), employeeId (FK), daysWorked, daysAbsent, grossEarnings, pfDeduction, esicDeduction?, tdsDeduction?, ptDeduction?, otherDeductions?, netPayable
audit_logs        → id (PK, UUID), userId (FK), action, targetEntity, targetId, metadata (JSONB), ipAddress?
refresh_tokens    → id (PK, UUID), userId (FK), token (unique), expiresAt, deviceInfo?
```

### Connection Pool Configuration

```yaml
# application.yml — HikariCP (Spring Boot default)
spring:
  datasource:
    hikari:
      maximum-pool-size: 20        # Per instance. 2 instances × 20 = 40 total
      connection-timeout: 10000    # 10 seconds
      idle-timeout: 300000         # 5 minutes
# PostgreSQL: max_connections >= 50 (40 pool + admin headroom)
```

---

## 5. API Endpoints (Full Reference)

### 5.1 Auth Module
```
POST   /v1/auth/otp/request       # Send OTP to phone (mobile)
POST   /v1/auth/otp/verify        # Verify OTP, return JWT
POST   /v1/auth/login             # Email/password login (web)
POST   /v1/auth/refresh           # Refresh access token
POST   /v1/auth/logout            # Invalidate refresh token
```

### 5.2 Attendance Module
```
POST   /v1/attendance/punch       # Punch in/out with location + face
GET    /v1/attendance/today        # Employee's today's attendance
GET    /v1/attendance/logs         # Paginated attendance logs (admin/client)
GET    /v1/attendance/report       # Attendance report (daily/weekly/monthly)
GET    /v1/attendance/site/:siteId # Site-specific attendance summary
```

### 5.3 Location Module
```
POST   /v1/location/update        # Mobile sends live location
GET    /v1/location/live           # Live employee locations (ops dashboard)
GET    /v1/location/heatmap        # Heatmap data for a site/date range
GET    /v1/location/alerts         # Geofence violation alerts
```

### 5.4 Sites Module
```
GET    /v1/sites                   # List all sites (paginated)
POST   /v1/sites                   # Create site (admin)
GET    /v1/sites/:id               # Site details with geofence
PUT    /v1/sites/:id               # Update site
DELETE /v1/sites/:id               # Soft delete site
POST   /v1/sites/:id/geofence     # Set geofence polygon (GeoJSON)
GET    /v1/sites/:id/employees     # Employees assigned to site
```

### 5.5 Employees Module
```
GET    /v1/employees               # List employees (paginated, filterable)
POST   /v1/employees               # Create/onboard employee
GET    /v1/employees/:id           # Employee profile
PUT    /v1/employees/:id           # Update employee
GET    /v1/employees/:id/documents # List employee documents
POST   /v1/employees/:id/documents # Upload document (gets presigned URL)
PUT    /v1/employees/:id/documents/:docId/verify  # Verify document
POST   /v1/employees/:id/face      # Upload face image for recognition
```

### 5.6 Shifts Module
> **Note**: FM-OVERVIEW.md references "task view" for mobile. In V1, shift assignments serve as the employee's task list — there is no separate task entity. The schedule endpoint below provides the data for the mobile "task view".

```
GET    /v1/shifts                  # List shifts for site
POST   /v1/shifts                  # Create shift
PUT    /v1/shifts/:id              # Update shift
POST   /v1/shifts/assign           # Assign employee to shift on date
GET    /v1/shifts/schedule         # Get schedule for employee/date range
```

### 5.7 Site Updates Module
```
POST   /v1/site-updates            # Create site update (employee)
GET    /v1/site-updates            # List updates (paginated by site/date)
GET    /v1/site-updates/:id        # Single update details
```

### 5.8 Payroll Module
```
GET    /v1/payroll/salary-structures          # List all salary structures
POST   /v1/payroll/salary-structures          # Create salary structure
PUT    /v1/payroll/salary-structures/:id      # Update salary structure
POST   /v1/payroll/run                         # Initiate payroll run
GET    /v1/payroll/run/:id                     # Payroll run details
GET    /v1/payroll/run/:id/status              # Payroll run status (for polling)
POST   /v1/payroll/run/:id/approve             # Approve payroll
POST   /v1/payroll/run/:id/reject              # Reject payroll
GET    /v1/payroll/run/:id/bank-file           # Download bank disbursement file
GET    /v1/payroll/run/:id/payslips            # List payslips for a run
GET    /v1/payroll/reports                      # Payroll reports (PF, ESIC, TDS)
```

### 5.9 Notifications Module
```
POST   /v1/notifications/send       # Send targeted notification (admin)
GET    /v1/notifications            # List user's notifications
PUT    /v1/notifications/:id/read   # Mark notification as read
POST   /v1/notifications/register-device  # Register FCM token
```

### 5.10 Admin Module
```
GET    /v1/admin/users              # List all users (super admin)
POST   /v1/admin/users              # Create user with role
PUT    /v1/admin/users/:id          # Update user role/status
GET    /v1/admin/audit-logs         # Audit trail (paginated)
GET    /v1/admin/dashboard/stats    # System-wide statistics
POST   /v1/admin/export/:entity     # Export data (CSV/Excel)
GET    /v1/admin/config             # System configuration
PUT    /v1/admin/config             # Update system configuration
```

### 5.11 Media Module
```
POST   /v1/media/presigned-url      # Get presigned upload URL
POST   /v1/media/confirm            # Confirm upload completion
```

---

## 6. Key Implementation Patterns

### 6.1 Response Envelope (ControllerAdvice)
All responses MUST use the standard envelope from `PLANNING.md`:
```java
// common/interceptor/ResponseEnvelopeAdvice.java
@RestControllerAdvice
public class ResponseEnvelopeAdvice implements ResponseBodyAdvice<Object> {

    @Override
    public boolean supports(MethodParameter returnType, Class converterType) {
        return true;
    }

    @Override
    public Object beforeBodyWrite(Object body, MethodParameter returnType,
            MediaType mediaType, Class converterType,
            ServerHttpRequest request, ServerHttpResponse response) {
        if (body instanceof ApiResponse) return body; // already wrapped
        return ApiResponse.success(body);
    }
}
```

### 6.2 Global Exception Handler
```java
// common/exception/GlobalExceptionHandler.java
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<?>> handleException(Exception ex) {
        // Map to standard error envelope
        // Log with correlation ID (MDC)
        // Return { success: false, data: null, error: { code, message, details } }
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<?>> handleValidation(MethodArgumentNotValidException ex) {
        // Extract field errors from BindingResult
        // Return VALIDATION_ERROR with field-level details
    }
}
```

### 6.3 Geofence Validation (Native SQL via JPA)
```java
// modules/attendance/AttendanceService.java
@Service
@RequiredArgsConstructor
public class AttendanceService {

    @PersistenceContext
    private EntityManager entityManager;

    public boolean validateGeofence(double lat, double lng, UUID siteId) {
        String sql = """
            SELECT ST_DWithin(
                geofence::geography,
                ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography,
                0
            ) as is_inside
            FROM sites WHERE id = :siteId
            """;
        Boolean result = (Boolean) entityManager.createNativeQuery(sql)
            .setParameter("lng", lng)
            .setParameter("lat", lat)
            .setParameter("siteId", siteId)
            .getSingleResult();
        return Boolean.TRUE.equals(result);
    }
}
```

### 6.4 Idempotent Punch Submission
Mobile may retry punches (network issues). Backend MUST handle duplicates:
```java
// Check if punch exists within 5-minute window
Optional<AttendanceLog> existing = attendanceLogRepository
    .findByEmployeeIdAndPunchTypeAndPunchTimeBetween(
        employeeId,
        punchType,
        Instant.ofEpochMilli(timestamp - 5 * 60 * 1000),
        Instant.ofEpochMilli(timestamp + 5 * 60 * 1000)
    );
if (existing.isPresent()) {
    return new DuplicatePunchResponse("DUPLICATE_PUNCH", existing.get().getId());
}
```

### 6.5 Background Job Definitions (@Async + @Scheduled)
```java
// scheduler/PayrollJobScheduler.java
@Service
@RequiredArgsConstructor
public class PayrollJobScheduler {

    @Async("payrollExecutor")
    public CompletableFuture<Void> processPayroll(UUID payrollRunId, int month, int year, UUID orgId) {
        // Full payroll computation — runs in background thread pool
        // Updates payroll_run status to PENDING_APPROVAL on completion
    }
}

// scheduler/RetentionCleanupJob.java
@Component
public class RetentionCleanupJob {

    @Scheduled(cron = "0 0 2 * * *", zone = "Asia/Kolkata") // Daily 2 AM IST
    public void cleanupExpiredData() {
        // Delete location_history > 30 days
        // Delete expired site_update media from R2/S3
    }
}

// scheduler/HeatmapAggregationJob.java
@Component
public class HeatmapAggregationJob {

    @Scheduled(cron = "0 0 3 * * *", zone = "Asia/Kolkata") // Daily 3 AM IST
    public void aggregateHeatmapData() {
        // Aggregate location data for heatmap visualizations
    }
}
```

### 6.6 Location Batch-Insert Strategy (Scalability Critical)

At 3,000 users, location updates arrive at **100 req/s**. Writing each to PostgreSQL individually is unsustainable. Strategy:

```java
// modules/location/LocationService.java
@Service
@RequiredArgsConstructor
public class LocationService {

    private final StringRedisTemplate redisTemplate;
    private final LocationHistoryRepository locationRepo;

    // 1. EVERY request: write to Redis only (fast path, <100ms)
    public void handleLocationUpdate(LocationUpdateDto dto) {
        String key = "loc:" + dto.getEmployeeId();
        String value = objectMapper.writeValueAsString(dto);
        redisTemplate.opsForValue().set(key, value, Duration.ofSeconds(120));
        // Geofence check happens here too (PostGIS query on the live update)
    }

    // 2. SAMPLED: @Scheduled flushes Redis → PostgreSQL every 5 min
    @Scheduled(fixedRate = 300_000) // 5 minutes
    public void flushLocationsToDatabase() {
        Set<String> keys = redisTemplate.keys("loc:*");
        if (keys == null || keys.isEmpty()) return;
        List<LocationHistory> batch = keys.stream()
            .map(key -> redisTemplate.opsForValue().get(key))
            .filter(Objects::nonNull)
            .map(json -> objectMapper.readValue(json, LocationHistory.class))
            .toList();
        locationRepo.saveAll(batch); // Batch insert ~3,000 rows = trivial
    }
}
```

---

## 7. Indian Statutory Compliance — Payroll Rules

### 7.1 Provident Fund (PF)
- **Employee contribution**: 12% of Basic + DA (capped at ₹15,000 base)
- **Employer contribution**: 12% of Basic + DA (3.67% to EPF, 8.33% to EPS)
- **PF ECR file**: Generate monthly for EPFO portal upload

### 7.2 ESIC (Employee State Insurance)
- **Applicable if**: Gross salary ≤ ₹21,000/month
- **Employee contribution**: 0.75% of Gross
- **Employer contribution**: 3.25% of Gross
- **Re-evaluate** every April and October

### 7.3 TDS (Tax Deducted at Source)
- **Old regime slabs** (default, configurable):
  - ₹0 – ₹2,50,000: Nil
  - ₹2,50,001 – ₹5,00,000: 5%
  - ₹5,00,001 – ₹10,00,000: 20%
  - Above ₹10,00,000: 30%
- **Monthly TDS** = Estimated annual tax / 12
- **Important**: Store TDS slabs as configuration, not hardcoded. They change annually.

### 7.4 Professional Tax (PT)
- **State-specific** (Maharashtra for V1):
  - Gross ≤ ₹7,500: Nil
  - ₹7,501 – ₹10,000: ₹175/month
  - Above ₹10,000: ₹200/month (₹300 in February)
- **Store PT rules** as configurable per-state data.

---

## 8. Background Jobs (Spring Scheduler / @Async)

| Job Name | Trigger | Schedule | Description |
|----------|---------|----------|-------------|
| `processPayroll` | @Async (on-demand) | On-demand | Full payroll computation for a month |
| `generateBankFile` | @Async (on-demand) | After payroll approval | CSV/Excel for bank disbursement |
| `cleanupLocationData` | @Scheduled | Daily 2:00 AM IST | Delete location_history > 30 days |
| `cleanupMedia` | @Scheduled | Daily 2:30 AM IST | Delete expired media from R2/S3 |
| `aggregateHeatmap` | @Scheduled | Daily 3:00 AM IST | Aggregate location data for heatmaps |
| `generateThumbnail` | @Async (on upload) | On upload | Resize images, extract video frames |
| `sendShiftReminder` | @Scheduled | 30 min before shift | FCM notification to employee |
| `geofenceAlert` | @Async (triggered) | Real-time | Alert when employee exits geofence >5 min |

---

## 9. Critical Design Decisions

### 9.1 PostGIS Geofence Storage
- Sites with simple circular geofences: use `latitude`, `longitude`, `geofenceRadius` columns.
- Sites with polygon geofences: store as `geography(Polygon, 4326)` column (managed via native SQL since JPA doesn't natively manage PostGIS types — use Hibernate Spatial).
- **Migration approach**: Start with circular geofences for V1 MVP, add polygon support as an enhancement.

### 9.2 Face Recognition Architecture
- **Storage**: Face embedding vector stored as `float[]` in PostgreSQL.
- **Comparison**: Use cosine similarity on backend. Threshold: 0.85.
- **Mobile captures** the face image, uploads via presigned URL, and sends the URL in the punch request.
- **Backend** extracts embedding from the upload (using a face recognition library or Python microservice), compares with stored embedding.
- **V2 consideration**: Move face comparison to a dedicated Python microservice for GPU acceleration.

### 9.3 Multi-Tenancy
- **Strategy**: Single database, `organizationId` column on all tables.
- **Every query** MUST filter by `organizationId`. Use a Spring `HandlerInterceptor` or `@Filter` to inject this automatically.
- **Row-level security** (PostgreSQL RLS) as an additional safety net.

---

## 10. Performance & Scalability (3,000+ Users)

> **Design target**: 3,000 active field employees at launch. System must handle **100 req/s sustained** (location updates) with headroom for bursty punch-ins.

### 10.1 Endpoint Performance Targets

| Endpoint | Target (p95) | Strategy |
|----------|-------------|----------|
| `POST /v1/attendance/punch` | < 500ms | Geofence check is the bottleneck. Use GiST spatial index. |
| `POST /v1/location/update` | < 100ms | Redis write only. PostgreSQL write is async (batched every 5 min, see §6.6). |
| `GET /v1/location/live` | < 200ms | Pure Redis read (SCAN `loc:*` for site). |
| `GET /v1/attendance/report` | < 1s | Indexed queries. Consider materialized views for common reports. |
| `POST /v1/payroll/run` | < 500ms | Returns immediately. @Async does the work. |
| `GET /v1/payroll/run/:id/status` | < 50ms | Simple DB read. |

### 10.2 Redis Caching Strategy

Cache hot-path data to reduce PostgreSQL load:

| Cache Key Pattern | Data | TTL | Invalidation |
|-------------------|------|-----|---------------|
| `loc:{employeeId}` | Live location + device info | 120s | Overwritten every 30s by mobile |
| `profile:{employeeId}` | Employee profile (name, site, photo URL) | 10 min | Invalidate on profile update |
| `shift:{employeeId}:{date}` | Today's shift assignment | 1 hour | Invalidate on shift reassignment |
| `site:{siteId}:geofence` | Geofence polygon/radius | 30 min | Invalidate on geofence edit |
| `report:attendance:{siteId}:{date}` | Daily attendance summary (for client portal) | 5 min | Short TTL, auto-expires |

### 10.3 Rate Limiting (Per-User)

Prevent abuse and protect backend at scale. Implemented via a custom Spring `HandlerInterceptor` backed by Redis counters:

| Endpoint | Limit | Enforcement |
|----------|-------|-------------|
| `POST /v1/auth/otp/request` | 5 req/min per phone | Redis counter |
| `POST /v1/location/update` | 1 req/10s per user | Redis counter (reject if too frequent) |
| `POST /v1/attendance/punch` | 1 req/min per user | Business logic (DUPLICATE_PUNCH check covers this) |
| All other endpoints | 100 req/min per user | Custom RateLimitInterceptor |

### 10.4 Connection Pooling

- **HikariCP** (Spring Boot default): `maximum-pool-size=20` per instance
- **2 API instances**: 2 × 20 = 40 connections total
- **PostgreSQL**: Set `max_connections = 60` (40 pool + admin headroom)
- **Redis**: Lettuce (Spring Boot default) with connection pooling

---

## 11. Logging & Monitoring

```json
// Structured logging format (SLF4J + Logback with JSON encoder)
{
  "level": "INFO",
  "timestamp": "2026-03-30T10:30:00+05:30",
  "correlationId": "uuid-v4",
  "module": "attendance",
  "action": "punch_in",
  "userId": "uuid",
  "employeeId": "uuid",
  "siteId": "uuid",
  "duration_ms": 145,
  "metadata": { "isInsideGeofence": true, "faceMatchScore": 0.92 }
}
```

- **Correlation ID**: Generated per request via MDC (Mapped Diagnostic Context), passed through all operations.
- **Health check**: `GET /v1/health` — returns DB, Redis, and storage connectivity status (Spring Boot Actuator).
- **Metrics**: Spring Boot Actuator + Micrometer for Prometheus-compatible metrics if monitoring is set up.

---

## 12. Deployment Must-Dos

The following are cross-cutting concerns identified during tech stack analysis that should be addressed before or during production launch:
- **Database Failover**: Currently a single point of failure. Implement PostgreSQL streaming replication (warm standby) or use a managed database service before production launch.
- **Redis Live Location Lookups**: The `SCAN loc:*` query is O(N) and blocks Redis. Switch to per-site Redis `HASH` or `SET` for O(1) performance to handle 3,000+ users.
- **Database Partitioning**: Implement table partitioning for `location_history` by month to handle unbounded growth (~2.6M rows/month at 3K users).

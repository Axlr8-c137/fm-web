  
# Facility Management Application   
Scope of Work \- Custom Product Build (V1) 

## 1\. Project Overview##  

This document outlines the scope of work for the design, development, testing, and deployment of a custom Facility Management Application. The product comprises an Android mobile application for field employees, a client-facing attendance reporting module, an operations monitoring dashboard for supervisors, and a full-feature payroll management web portal with Indian statutory compliance (PF, ESIC, TDS, PT). The system is designed for 1,000 \- 3,000 active users at launch. 

## 2\. Scope of Work##  

## 2.1 Employee Attendance & Geofencing##  

• Mobile OTP-based login with secure session management 

• Geofence-based automatic punch in/out to verify employee work location 

• Facial recognition for attendance verification 

• Employee shift schedules and task assignment view 

• Push notifications for upcoming shifts and assignments 

• Employee ID card section within the app 

## 2.2 Site Updates##  

• Real-time site status reporting by field employees 

• Support for text, photo, and video attachments 

• All updates timestamped and tagged per employee per site 

## 2.3 Payroll Web Portal (Full Engine)##  

• Secure admin login and role-based access control 

• Employee salary structure management with configurable components 

• Automatic PF, ESIC, TDS, and PT computation per Indian statutory requirements • Payroll run execution with approval workflow 

• Bank file generation for salary disbursement 

• Payroll reports and accounting exports

## 2.4 Client Attendance Reporting##  

• Monthly, weekly, and daily attendance reports for client-assigned personnel • Reports include late arrivals, early departures, and absences 

## 2.5 Operations Monitoring Dashboard##  

• Real-time employee location tracking on map 

• Automatic alerts when employee leaves geofenced site for more than 5 minutes • Device battery level, signal status, and airplane mode auditing 

• Employee location heatmap for site analytics 

• New employee onboarding flow (name, DOB, mobile, Aadhaar, PAN, ration card, police verification, PF & ESIC documents) 

## 2.6 Super Admin Panel##  

• Full system access with product-owner level control 

• User and role management across all user classes 

• Site creation, editing, and deletion 

• System configuration and data export capabilities 

## 2.7 Multi-language Support##  

• English, Hindi, and Marathi language support across all V1 mobile modules 

## 2.8 Backend Infrastructure & Deployment##  

• Java 17 / Spring Boot 3.4 API server with Maven 

• PostgreSQL database with PostGIS extension for location queries 

• Redis caching layer for performance 

• NGINX reverse proxy with HTTPS and SSL 

• Object storage integration (Cloudflare R2 / AWS S3) for images and documents • JWT-based authentication and authorization 

• Push notification service integration 

• Spring Scheduler / @Async background job processing (data cleanup, payroll, heatmap aggregation) • Automated 30-day data retention policy for location and image data 

• Production deployment, server configuration, and handover documentation 

## 3\. Out of Scope##  

The following are explicitly excluded from this engagement and will be scoped and quoted separately if required: 

• iOS application development (deferred to V2) 

• Visitor Management module \- registration, access passes, entry/exit tracking (V2) • Customer Complaints & Ticket System \- submission, routing, resolution tracking (V2) • Any feature, integration, screen, or module not explicitly listed in Section 2 above • Ongoing content creation, social media, or marketing services

## 4\. Assumptions & Dependencies##  

• Client will provide all brand assets (logo, color palette, reference imagery) prior to design phase 

• Cloud hosting account and credentials will be set up by the client (Knightsbridge will configure) • Payment gateway merchant account (if applicable for future phases) is the client's responsibility 

• Timely feedback on design and demo milestones to avoid schedule delays • Domain name ownership and DNS access will be provided by the client 

• All ongoing infrastructure costs (hosting, storage, APIs) are borne by the client 

## 5\. Indicative Timeline##  

Total project duration: 10 weeks (50 working days) from advance payment receipt. 

| Phase 1  | Setup, Backend Foundation, DB Schema, Auth \- Week 1 to 2 |
| :---- | :---- |
|  **Phase 2**   | Android App Core, Geofencing, Attendance, Site Updates \- Week 3 to 5 |
| **Phase 3**   | Payroll Engine, Facial Recognition, Heatmaps, Multi-language \- Week 5 to 7 |
|  **Phase 4**   | Ops Dashboard, Super Admin, Integration, Bank Files \- Week 7 to 8 |
|  **Phase 5**   | QA, Testing, Play Store Deployment, Handover \- Week 9 to 10 |


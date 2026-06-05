# Hearth & Hollow Project Playbook

**Last Updated:** June 5, 2026  
**Project Status:** Production Ready  
**Live Site:** https://www.thehearthhollow.com

---

## Quick Start for New Agents

1. Read this entire file first
2. Review CLAUDE.md for architecture overview
3. Check git log to see recent changes
4. Ask clarifying questions about next features
5. Test locally before deploying

---

## Project Overview

**Hearth & Hollow** is a Next.js 14 full-stack web application for a custom handyman/carpentry business. It handles:
- Client quote requests with photo uploads
- AI-powered estimate generation (Claude API)
- Admin quote management dashboard
- Client email approval/denial workflows
- Theme customization system

**Live Production:** https://www.thehearthhollow.com  
**Repo:** Git repository on GitHub (connected to Vercel)

---

## Technology Stack

```
Frontend:        Next.js 14.2.35, React, TypeScript, Tailwind CSS
Backend:         Next.js API routes
Database:        PostgreSQL (Neon - managed)
ORM:             Prisma 5.22.0
AI:              Anthropic Claude API
File Storage:    AWS S3
Email:           Resend
Auth:            NextAuth (admin session via cookies)
Hosting:         Vercel
```

---

## Current Features (As of June 5, 2026)

### ✅ Core Functionality
- **Quote Requests**: Clients submit project details + photos via /request page
- **Quote Analysis**: Admin analyzes quotes, AI generates estimates
- **Email Workflow**: Send estimates to clients via email
- **Approval/Denial**: Clients approve/deny via email links (fixed June 5)
- **Dashboard**: Admin dashboard with 4 status tabs

### ✅ Admin Features (In Production)
1. **Quote Management**
   - View all quotes in 4-tab dashboard (Awaiting Analysis, Waiting Approval, Active, Denied)
   - Analyze quotes with Claude AI (generates cost estimates, breakdown, timeline)
   - Edit estimates manually (prices, materials, timeline)
   - Send estimates to customers via email
   - Approve/deny quotes manually
   - Delete individual quotes
   
2. **Bulk Operations**
   - Multi-select quotes with checkboxes
   - Bulk delete with confirmation
   - Bulk move to different status tabs
   - Select all / deselect all toggle
   
3. **Global Search**
   - Search all quotes by: email, name, phone, address
   - Real-time filtering across all tabs
   - Shows result count
   
4. **Theme Customizer** (NEW - June 5)
   - Customize 7 colors (primary, secondary, accent, text, background, border)
   - Customize 2 fonts (body, heading)
   - Customize branding (site name, description)
   - Live preview panel
   - Persistent database storage
   - Real-time updates across site (30-second refresh)
   - Reset to defaults option

### ✅ Client Features
- Quote request submission page with file uploads
- Email approval/denial links (working as of June 5)
- Confirmation pages for approved/denied quotes
- Responsive mobile-friendly design

---

## Database Schema (Prisma)

### Models
```
Customer
├── id (cuid)
├── name
├── email (unique)
├── phone
├── projectRequests (relation)

ProjectRequest
├── id (cuid)
├── customerId (FK)
├── customer (relation)
├── category, location, timeline, description
├── status (submitted|analyzing|approved|sent|accepted|declined)
├── approvalStatus (awaiting_analysis|awaiting_client_approval|active|denied)
├── clientApprovedAt, clientDeniedAt, emailSentAt (timestamps)
├── uploadedAssets (relation)
├── estimate (relation)

UploadedAsset
├── id (cuid)
├── projectId (FK)
├── filename, s3Url, mimeType, fileSize
├── createdAt

Estimate
├── id (cuid)
├── projectId (FK unique)
├── lowEstimate, expectedEstimate, highEstimate
├── breakdown (text)
├── materialRequirements, timeEstimation (optional)
├── isEdited (boolean - tracks admin modifications)
├── confidence, status, sentAt, rawAnalysis

ThemeSettings (NEW - June 5)
├── id (cuid)
├── primaryColor, secondaryColor, accentColor
├── textPrimary, textSecondary, backgroundColor, borderColor
├── fontFamily, headingFont
├── siteName, siteDescription

AdminUser
├── id (cuid)
├── email (unique)
├── password (bcrypt)
├── name
```

---

## API Endpoints

### Public Endpoints (No Auth Required)
```
GET  /api/theme                              - Get theme settings (for site)
POST /api/requests                           - Submit quote request (multipart form-data)
GET  /api/quotes/[id]/approve?email=X       - Client approves quote (redirects)
GET  /api/quotes/[id]/deny?email=X          - Client denies quote (redirects)
```

### Admin Endpoints (Requires admin_session cookie)
```
POST /api/admin/login                        - Login with password
POST /api/admin/logout                       - Logout

GET  /api/admin/quotes                       - Get all quotes (grouped by customer)
GET  /api/admin/quotes/[id]                  - Get single quote
PATCH /api/admin/quotes/[id]                 - Edit quote details
POST /api/admin/quotes/[id]/analyze          - Analyze with Claude AI
PATCH /api/admin/quotes/[id]/estimate        - Edit estimate values
PATCH /api/admin/quotes/[id]/status          - Change approval status
POST /api/admin/quotes/[id]/send             - Send estimate email to customer
DELETE /api/admin/quotes/[id]/delete         - Delete quote (cascades)
POST /api/admin/quotes/[id]/get-signed-url   - Get signed URL for S3 assets

POST /api/admin/bulk-actions/delete          - Bulk delete quotes
POST /api/admin/bulk-actions/move            - Bulk move quotes to status

PATCH /api/admin/theme                       - Update theme settings
```

---

## Directory Structure

```
app/
├── layout.tsx                    - Root layout with ThemeProvider
├── globals.css                   - Base styles
├── page.tsx                      - Home page
├── request/
│   └── page.tsx                  - Quote request form
├── confirmation/[id]/
│   └── page.tsx                  - Request submission confirmation
├── quote-approval/[id]/
│   └── page.tsx                  - Approval/denial confirmation (NEW - June 5)
├── admin/
│   ├── page.tsx                  - Login page
│   ├── dashboard/
│   │   └── page.tsx              - Main admin dashboard (4 tabs + search)
│   ├── theme/
│   │   └── page.tsx              - Theme customizer (NEW - June 5)
│   └── quotes/[id]/
│       └── page.tsx              - Quote detail + edit page
├── api/
│   ├── theme/
│   │   └── route.ts              - Public theme endpoint
│   ├── admin/
│   │   ├── login/route.ts        - Admin authentication
│   │   ├── logout/route.ts
│   │   ├── theme/route.ts        - Admin theme update
│   │   ├── quotes/
│   │   │   ├── route.ts          - List all quotes
│   │   │   └── [id]/
│   │   │       ├── route.ts      - Get/edit quote
│   │   │       ├── analyze/      - AI analysis
│   │   │       ├── estimate/     - Edit estimate
│   │   │       ├── status/       - Change status
│   │   │       ├── send/         - Send email
│   │   │       ├── delete/       - Delete quote (NEW - June 5)
│   │   │       └── get-signed-url/
│   │   └── bulk-actions/
│   │       ├── delete/route.ts   - Bulk delete (NEW - June 5)
│   │       └── move/route.ts     - Bulk move (NEW - June 5)
│   ├── quotes/[id]/
│   │   ├── approve/route.ts      - Client approve (FIXED - June 5)
│   │   └── deny/route.ts         - Client deny (FIXED - June 5)
│   └── requests/route.ts         - Quote submission
├── components/
│   └── ThemeProvider.tsx         - Global theme provider (NEW - June 5)
└── styles/
    └── theme.css                 - CSS variables (NEW - June 5)

lib/
├── prisma.ts                     - Prisma client singleton
├── email.ts                      - Email sending (Resend)

prisma/
├── schema.prisma                 - Database schema
```

---

## Critical Environment Variables

```
ADMIN_PASSWORD              - Admin login password
ANTHROPIC_API_KEY           - Claude API key
DATABASE_URL_UNPOOLED       - Production database (Neon)
RESEND_API_KEY              - Email service API key
RESEND_FROM_EMAIL           - Email from address
AWS_ACCESS_KEY_ID           - S3 credentials
AWS_SECRET_ACCESS_KEY       - S3 credentials
AWS_S3_BUCKET_NAME          - S3 bucket name
AWS_REGION                  - AWS region
VERCEL_URL                  - Set by Vercel (used for redirects)
NEXT_PUBLIC_COMPANY_NAME    - Public site name
```

**Note:** DATABASE_URL is empty locally (uses DATABASE_URL_UNPOOLED in production)

---

## What Was Done on June 5, 2026

### Morning Session: Admin Portal Enhancements
1. ✅ **Quote Deletion Feature**
   - DELETE endpoint at `/api/admin/quotes/[id]/delete`
   - Delete button in quote detail page
   - Confirmation dialog
   - Cascading deletion of assets and estimates

2. ✅ **Bulk Operations**
   - Multi-select checkboxes on dashboard
   - Select all / deselect all toggle
   - Bulk delete with confirmation
   - Bulk move to different approval statuses
   - Two new API endpoints: `/api/admin/bulk-actions/delete` and `/move`
   - Visual toolbar showing selected count

3. ✅ **Global Search**
   - Search input at top of dashboard
   - Search by: email, name, phone, address (location in description)
   - Real-time filtering across all tabs
   - Result count display
   - Tabs disabled during search

4. ✅ **Theme Customizer** (Major Addition)
   - `/admin/theme` page with full UI
   - Customize 7 colors with color pickers
   - Customize 2 fonts (body and heading)
   - Customize site name and description
   - Live preview panel showing changes
   - Reset to defaults button
   - `ThemeSettings` Prisma model
   - CSS variables system (`--color-primary`, etc.)
   - ThemeProvider component for global application
   - Public API endpoint for theme
   - 30-second real-time refresh
   - LocalStorage caching for performance

### Afternoon Session: Bug Fixes
5. ✅ **Client Approval/Denial Fix**
   - Fixed redirect URL construction in approve/deny endpoints
   - Changed from using `request.url` to `VERCEL_URL` environment variable
   - Proper base URL handling for production and dev

6. ✅ **Vercel Deployment Protection Fix (June 5 Evening)**
   - Created dedicated `/quote-approval/[id]` page for approval/denial responses
   - Separate messaging for approved vs. declined quotes
   - **Critical**: Fixed Vercel Deployment Protection blocking public API routes
     - User had to disable/configure protection in Vercel dashboard
     - Client approval/denial links now work without Vercel login

---

## Known Issues & Todos

### Fixed Issues
- ✅ Email approval/denial links working (was broken, fixed June 5)
- ✅ Theme customization (added June 5)
- ✅ Quote deletion (added June 5)
- ✅ Bulk operations (added June 5)

### Possible Future Improvements
- [ ] Add more theme customization (button styles, border radius, spacing)
- [ ] Add quote analytics/dashboard
- [ ] Add customer portal (track own quotes)
- [ ] Add project timeline/progress tracking
- [ ] Add messaging between admin and customer
- [ ] Add export quotes to PDF
- [ ] Add quote templates
- [ ] Add repeat customer tracking
- [ ] Mobile app
- [ ] Payment integration

---

## Development Workflow

### Local Development
```bash
npm install              # Install dependencies
npm run dev              # Start dev server (port 3001)
npx prisma studio       # Open Prisma UI
npx prisma generate     # Regenerate Prisma client
```

### Database
```bash
# Push schema changes to dev database
DATABASE_URL="postgresql://..." npx prisma db push

# Generate migrations
npx prisma migrate dev --name <name>

# Push to production
DATABASE_URL="postgresql://..." npx prisma db push --skip-generate
```

### Deployment
```bash
git add .
git commit -m "message"
git push                 # Triggers Vercel auto-deploy
vercel deploy --prod     # Manual deploy
```

---

## Critical Implementation Details

### Authentication
- Admin uses password-based session (cookie: `admin_session`)
- Client approval/denial uses email verification (query param matching)
- Session expires in 7 days

### Email System
- Uses Resend for delivery
- Approval/denial links are GET requests (clients click from email)
- Links include email as query parameter for verification
- Broken June 5 due to Vercel Deployment Protection (now fixed)

### Theme System (NEW)
- Stored in database (ThemeSettings model)
- Applied via CSS variables at document root
- ThemeProvider fetches theme on page load + every 30 seconds
- Fallback to localStorage for offline access
- Admin can reset to defaults anytime

### Deployment
- Hosted on Vercel with GitHub integration
- Auto-deploys on push to main branch
- Production database: Neon PostgreSQL
- **IMPORTANT**: Vercel Deployment Protection was blocking public routes
  - Solution: Disable or configure in Vercel dashboard
  - Affects: `/api/quotes/*/approve` and `/api/quotes/*/deny`

---

## Testing Checklist Before Deployment

- [ ] Quote submission form works
- [ ] File uploads to S3 successful
- [ ] AI analysis generates estimates
- [ ] Email sends to customer
- [ ] Client approval link works (no Vercel login)
- [ ] Client deny link works
- [ ] Admin can edit estimates
- [ ] Admin can change quote status
- [ ] Bulk delete works
- [ ] Bulk move works
- [ ] Search works across all tabs
- [ ] Theme changes apply globally
- [ ] Theme persists after page reload
- [ ] Theme resets to defaults

---

## Important Notes for Future Development

1. **Vercel Deployment Protection**: Must be configured in dashboard to allow public routes
2. **Database Migrations**: Always test locally first, then run on production using DATABASE_URL_UNPOOLED
3. **Theme System**: Changes apply globally - test thoroughly before deploying
4. **Bulk Operations**: Always require confirmation to prevent accidental deletions
5. **Client Email Links**: Must be GET requests with email verification for security
6. **Prisma Regeneration**: Always run `npx prisma generate` after schema changes
7. **AWS S3**: Ensure credentials are set and bucket is accessible
8. **Email**: Test with real emails before enabling for all users

---

## Git Commit History (Recent)

```
79fcd02 - Create dedicated quote approval/denial pages (June 5)
4f6e9ed - Fix client approval/denial redirect URLs (June 5)
ef338bb - Add admin theme customizer with live preview (June 5)
100c0cf - Add global search to admin dashboard (June 5)
60db07c - Add bulk quote operations to admin dashboard (June 5)
7702b69 - Add quote deletion functionality to admin panel (June 5)
```

---

## Contact/Handoff Notes

**Original Developer:** Hunter (Hammo)  
**Email:** hammondhunterc@gmail.com  
**Site:** https://www.thehearthhollow.com  

For future agents:
- This project is in active development
- Focus on user experience and reliability
- Always test new features locally before deploying
- Keep the theme customizer in mind - it affects the entire site
- The bulk operations are powerful - ensure they have proper confirmations
- Vercel Deployment Protection is critical - document any changes to how it's configured

---

**Happy coding! 🛠️**

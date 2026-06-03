# Handyman Quote Generator — AI-Assisted Estimate System

A professional web application for automated project intake, image analysis, and intelligent quote generation for handyman and carpentry services.

## Features

✅ **Customer Portal** — Project request form with photo upload
✅ **AI Analysis** — Claude vision + text analysis for scope assessment
✅ **Auto Estimates** — Generate low/expected/high estimates automatically
✅ **Admin Dashboard** — Review, approve, modify, and send quotes
✅ **Responsive Design** — Mobile-first, works on all devices
✅ **Email Delivery** — Send professional PDF estimates to customers
✅ **Database Tracking** — Full history for future ML training

## Tech Stack

- **Frontend:** Next.js 14, TypeScript, Tailwind CSS
- **Backend:** Next.js API Routes
- **Database:** PostgreSQL (Neon)
- **AI:** Claude 3.5 Sonnet (Anthropic)
- **File Storage:** AWS S3
- **Email:** Resend
- **Hosting:** Vercel
- **Auth:** NextAuth.js

## Quick Start (Local Development)

### 1. Clone & Install

```bash
git clone <your-repo> handyman-quote-generator
cd handyman-quote-generator
npm install
```

### 2. Set Up Database

Create a `.env.local` file (copy from `.env.example`):

```bash
cp .env.example .env.local
```

Edit `.env.local` and fill in:
- `DATABASE_URL` — Your Neon PostgreSQL connection string
- `ANTHROPIC_API_KEY` — Claude API key
- `AWS_*` — S3 credentials
- `RESEND_API_KEY` — Email service
- `NEXTAUTH_SECRET` — Generate with `openssl rand -base64 32`
- `ADMIN_EMAIL` — Your email

### 3. Initialize Database

```bash
npx prisma db push
npx prisma studio  # Optional: visual DB browser
```

### 4. Run Locally

```bash
npm run dev
```

Visit `http://localhost:3000`

## Deployment to Vercel

### 1. Create GitHub Repo

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin <your-github-url>
git push -u origin main
```

### 2. Create Neon Database

1. Go to [neon.tech](https://neon.tech)
2. Create new project, copy connection string
3. **Do not push this to git** — use Vercel environment variables

### 3. Deploy to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Connect GitHub repo
3. Add environment variables in Vercel dashboard:
   - `DATABASE_URL`
   - `ANTHROPIC_API_KEY`
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
   - `AWS_REGION`
   - `AWS_S3_BUCKET`
   - `RESEND_API_KEY`
   - `NEXTAUTH_SECRET`
   - `ADMIN_EMAIL`
   - `NEXT_PUBLIC_COMPANY_NAME`
   - `NEXTAUTH_URL` (your vercel domain)

4. Click Deploy

5. Run migrations:
```bash
# After first deploy, SSH into Vercel and run:
npx prisma db push
```

## Project Structure

```
app/
  page.tsx           # Home page
  request/           # Customer quote request form
  confirmation/      # Confirmation after submission
  admin/             # Admin dashboard (protected)
    quotes/          # View incoming quotes
    review/          # Review & approve quotes
  api/
    requests/        # POST: Create new request
    analyze/         # POST: Trigger AI analysis
    estimates/       # GET/POST: Manage estimates
    auth/            # NextAuth endpoints

lib/
  prisma.ts          # Database client
  s3.ts              # S3 upload utility
  claude-analyzer.ts # AI analysis logic

prisma/
  schema.prisma      # Database schema
```

## Database Schema

### Customers
- id, name, email, phone, createdAt, updatedAt

### ProjectRequests
- id, customerId, category, location, timeline, description, status, createdAt, updatedAt

### UploadedAssets
- id, projectId, filename, s3Url, mimeType, fileSize, createdAt

### Estimates
- id, projectId, scope, complexity, confidence, labors, materials, travel, estimates (low/expected/high), status, approvedAt, sentAt

### EstimateHistory
- id, estimateJson, accepted, actualCost, completedAt, notes

## Pricing Formula

The AI uses this structure for estimates:

```
Labor Cost = Hours × $60/hour (adjustable)
Material Cost = (Estimated materials) × 1.25 (25% markup)
Travel = $35 flat fee (adjustable)
Subtotal = Labor + Materials + Travel

Low Estimate = Subtotal (no profit, competitive)
Expected = Subtotal × 1.40 (40% markup for overhead + profit)
High = Expected × 1.15 (buffer for unknowns)

Confidence Score: Based on photo quality and description detail
- 0.9+: Clear photos, detailed description
- 0.7-0.9: Good info, some unknowns
- <0.7: Vague description, site visit needed
```

## Admin Workflow

1. **Review Queue:** See new requests as they arrive
2. **View Photos:** Inspect all uploaded images
3. **See AI Analysis:** Scope, complexity, breakdown
4. **Approve or Modify:** Adjust line items as needed
5. **Send to Customer:** Customer gets professional PDF
6. **Track Status:** Monitor quote acceptance/rejection

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection | `postgresql://...` |
| `ANTHROPIC_API_KEY` | Claude API key | `sk-ant-...` |
| `AWS_ACCESS_KEY_ID` | S3 credentials | `AKIAIOSFODNN7EXAMPLE` |
| `AWS_SECRET_ACCESS_KEY` | S3 secret | `wJalrXUtnFEMI/K7MDENG...` |
| `AWS_REGION` | S3 region | `us-east-1` |
| `AWS_S3_BUCKET` | S3 bucket name | `handyman-quotes` |
| `RESEND_API_KEY` | Email API key | `re_...` |
| `NEXTAUTH_SECRET` | Session secret | Generate with openssl |
| `NEXTAUTH_URL` | Production URL | `https://yourdomain.com` |
| `ADMIN_EMAIL` | Your admin email | `you@example.com` |
| `NEXT_PUBLIC_COMPANY_NAME` | Company name | `Your Handyman Service` |
| `NEXT_PUBLIC_SITE_URL` | Public site URL | `https://yourdomain.com` |

## Cost Breakdown (Rough Monthly Estimates)

- **Vercel:** $0–20 (under free tier for MVP)
- **Neon DB:** $0 (free tier, ~25GB storage)
- **S3 Storage:** $1–5 (depends on photo volume)
- **Claude API:** $5–50 (depends on analysis volume)
- **Resend Email:** $0–20 (pay per email after free tier)
- **Domain:** $10–15 (if not using vercel.app)

**Total MVP:** $16–110/month depending on usage

## Next Steps

### Phase 2 (After MVP is live):
- [ ] Customer portal for tracking quote status
- [ ] SMS notifications
- [ ] Google Calendar integration for site visits
- [ ] QuickBooks sync for invoicing
- [ ] Analytics dashboard (quotes sent, acceptance rate)
- [ ] Historical pricing analysis

### Phase 3:
- [ ] Multi-user admin support
- [ ] Stripe integration for deposits
- [ ] Lead scoring based on project type
- [ ] Pricing model training on completed jobs

## Troubleshooting

### Images not uploading?
- Check AWS S3 credentials in environment variables
- Verify S3 bucket exists and is public readable
- Check file size limits (max 10MB per file)

### Estimates not generating?
- Verify `ANTHROPIC_API_KEY` is set correctly
- Check Claude API usage/quota
- Review server logs for API errors

### Email not sending?
- Verify `RESEND_API_KEY` is correct
- Check sender email is verified in Resend
- Review email logs in Resend dashboard

## Support

For issues or questions:
1. Check Vercel logs: `vercel logs`
2. Review local `.env.local` setup
3. Verify database connection: `npx prisma studio`
4. Check API responses in browser console

## License

Private — Built for your handyman business

---

**Ready to deploy?** Run `git push` and watch Vercel build! 🚀

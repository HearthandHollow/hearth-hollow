# Deployment Guide — Getting Live in 24 Hours

This guide walks you through deploying the Handyman Quote Generator to production with all services connected.

## Prerequisites

- GitHub account (free)
- Vercel account (free, linked to GitHub)
- AWS account (free tier works)
- Neon account (free tier works)
- Anthropic API key ($5 free credits)
- Resend account (free tier for first 100 emails)

**Total Cost:** $0 for MVP (all services have generous free tiers)

---

## Step 1: Create GitHub Repository (5 min)

1. Go to [github.com/new](https://github.com/new)
2. Create repo named `handyman-quote-generator`
3. Choose **Private** (keep your business setup private)
4. Click Create

Then locally:

```bash
cd /home/node/.openclaw/workspace-setup/handyman-quote-generator
git init
git add .
git commit -m "Initial commit: MVP"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/handyman-quote-generator.git
git push -u origin main
```

---

## Step 2: Set Up Database — Neon (10 min)

1. Go to [neon.tech](https://neon.tech) and sign up (free)
2. Create new project (select your region closest to you)
3. You'll get a PostgreSQL connection string like:
   ```
   postgresql://user:password@ep-xxx.region.neon.tech/dbname
   ```
4. **Save this** — you'll need it for Vercel

**Keep this secret!** Never commit `.env` to git.

---

## Step 3: Set Up AWS S3 (10 min)

You need S3 for photo storage.

1. Go to [aws.amazon.com](https://aws.amazon.com) and create account
2. Search for **S3** in the console
3. Click **Create bucket**
   - Name: `handyman-quotes-yourname` (must be globally unique)
   - Region: Pick your region
   - Uncheck "Block all public access" (you need to serve images)
   - Create bucket

4. Create IAM user for app:
   - Go to **IAM** → **Users** → **Create user**
   - Name: `handyman-app`
   - Attach policy: **AmazonS3FullAccess**
   - Create access key → Copy **Access Key ID** and **Secret Access Key**

**Save these credentials** — you'll need them for Vercel.

---

## Step 4: Get API Keys (10 min)

### Claude (Anthropic)
1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Sign up, click **API keys** in sidebar
3. Create new key, copy it

### Resend (Email)
1. Go to [resend.com](https://resend.com)
2. Sign up with email
3. Click **API Keys**, create new one
4. Copy the API key

### NextAuth Secret
Generate a random secret:
```bash
openssl rand -base64 32
```
Copy the output.

---

## Step 5: Deploy to Vercel (5 min)

1. Go to [vercel.com](https://vercel.com)
2. Sign up or log in with GitHub
3. Click **Add New...** → **Project**
4. Select your `handyman-quote-generator` repo
5. Click **Import**

6. **Add Environment Variables** before deploying:

   Copy and paste these (with your actual values):

   ```
   DATABASE_URL=postgresql://user:pass@ep-xxx.neon.tech/dbname
   ANTHROPIC_API_KEY=sk-ant-xxxxx
   AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
   AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENGxxxxx
   AWS_REGION=us-east-1
   AWS_S3_BUCKET=handyman-quotes-yourname
   RESEND_API_KEY=re_xxxxxx
   NEXTAUTH_SECRET=<paste-openssl-output>
   NEXTAUTH_URL=https://your-project.vercel.app
   ADMIN_EMAIL=your-email@example.com
   NEXT_PUBLIC_COMPANY_NAME=Your Handyman Service
   NEXT_PUBLIC_SITE_URL=https://your-project.vercel.app
   ```

7. Click **Deploy**

Vercel will build and deploy. This takes ~2 minutes.

**Wait for deployment to complete.**

---

## Step 6: Initialize Database (2 min)

After deployment succeeds, you need to run database migrations.

**Option A: Use Vercel CLI (Recommended)**

```bash
npm install -g vercel
vercel env pull  # Download production env vars
npx prisma db push
```

**Option B: Manually**

1. In Vercel dashboard, go to **Deployments**
2. Click the latest deployment → **Logs**
3. Look for errors related to database
4. If you see migration errors, you need to run:
   ```bash
   npx prisma db push
   ```
   from your local machine with `.env.local` set to your DATABASE_URL

---

## Step 7: Verify Deployment ✅

1. Go to your Vercel deployment URL (e.g., `https://handyman-quote-generator.vercel.app`)
2. You should see the home page
3. Click **Request Quote**
4. Fill out the form with test data
5. Upload a test image
6. Submit

**If it works, you're live!** 🎉

---

## Step 8: Add Your Domain (Optional)

If you have a custom domain:

1. In Vercel, go to **Settings** → **Domains**
2. Add your domain
3. Follow Vercel's instructions to update DNS records

---

## Troubleshooting

### "Database connection failed"
- Check `DATABASE_URL` in Vercel environment variables
- Verify Neon database is running
- Make sure `npx prisma db push` was run

### "S3 upload failed"
- Verify AWS credentials are correct
- Check bucket name matches `AWS_S3_BUCKET`
- Ensure bucket allows public access (for reading images)

### "Claude API error"
- Verify `ANTHROPIC_API_KEY` is correct
- Check API usage quota in Anthropic dashboard
- Make sure it starts with `sk-ant-`

### "Email not sending"
- Verify `RESEND_API_KEY` is correct
- In Resend dashboard, verify sender domain
- Check spam folder

### Blank page or 500 error
- Check Vercel deployment logs
- Look for build errors
- Verify all environment variables are set

---

## Next: Enable Estimates Analysis

Currently, the app accepts submissions but doesn't generate estimates yet.

To enable AI analysis after submission:

1. Create `/app/api/analyze/route.ts`
2. Import `analyzeProject` from `@/lib/claude-analyzer`
3. Trigger analysis after file upload
4. Save results to `Estimate` table

This will be added in Phase 2.

---

## Security Checklist

- [ ] GitHub repo is **Private**
- [ ] Never commit `.env` files to git
- [ ] Use Vercel environment variables, not `.env` in code
- [ ] Keep API keys secret — rotate if accidentally exposed
- [ ] Use strong `NEXTAUTH_SECRET`
- [ ] Enable HTTPS (Vercel does this by default)
- [ ] Add your IP to S3 bucket policy if paranoid

---

## Cost Monitoring

After deploying, monitor your spending:

- **Vercel Dashboard:** Usage stats
- **AWS Console:** S3 storage and data transfer
- **Neon Dashboard:** Database usage
- **Anthropic Console:** API usage

If you're concerned about costs, set up billing alerts in each service.

---

## Next Steps

1. ✅ Test the form submission (should reach confirmation page)
2. ⏳ Create admin dashboard login
3. ⏳ Implement estimate generation
4. ⏳ Add email delivery
5. ⏳ Train on historical pricing data

**Estimated time to full MVP:** 3–5 more days of development

---

## Live Demo Check

Your site should now be accessible at:
```
https://handyman-quote-generator-xxx.vercel.app/
```

Share this link to test with friends, or start collecting real customer submissions!

---

**Congratulations! Your quote generator is live.** 🚀

Next: Build the admin dashboard for reviewing estimates.

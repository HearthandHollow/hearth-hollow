# Quick Start — Get Your Quote Generator Live Today

**TL;DR:** 30 minutes to live, 2 hours to fully functional.

---

## 🚀 Phase 1: Get It Live (30 min)

### 1. Collect Your Credentials

Before you start, gather these (takes 10-15 min if you don't have them):

- [ ] GitHub account (free)
- [ ] Vercel account (free, login with GitHub)
- [ ] Neon PostgreSQL URL (free tier)
- [ ] AWS S3 bucket + credentials (free tier)
- [ ] Anthropic API key (free $5 credits)
- [ ] Resend API key (free tier)

**Get them here:**
- Neon: [neon.tech](https://neon.tech) → Create project → Copy connection string
- AWS: [console.aws.amazon.com](https://console.aws.amazon.com) → S3 → Create bucket + IAM user
- Claude: [console.anthropic.com](https://console.anthropic.com) → API Keys
- Resend: [resend.com](https://resend.com) → API Keys
- NextAuth Secret: Run `openssl rand -base64 32` locally

### 2. Push to GitHub

```bash
cd /home/node/.openclaw/workspace-setup/handyman-quote-generator

# Initialize git (if not done)
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/handyman-quote-generator.git
git push -u origin main
```

### 3. Deploy to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click **Add New → Project**
3. Select your `handyman-quote-generator` repo
4. **Paste all environment variables** (from step 1 above) ↓
5. Click **Deploy**

**Wait ~2 minutes for build to complete.**

### 4. Initialize Database

After Vercel finishes:

```bash
# Pull the production env vars
vercel env pull

# Initialize database with schema
npx prisma db push
```

**✅ DONE!** Your site is now live at `https://your-project.vercel.app`

Test it:
1. Visit your Vercel URL
2. Click "Request Quote"
3. Fill in test data
4. Upload a photo
5. Submit

You should see a confirmation page.

---

## 🔧 Phase 2: Make Estimates Work (1 hour)

The form works, but estimates aren't generating yet. Let's add that.

### Step 1: Create the Analysis API

Create `/app/api/analyze/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { analyzeProject } from "@/lib/claude-analyzer";

export async function POST(req: NextRequest) {
  try {
    const { projectId } = await req.json();

    // Get project and images
    const project = await prisma.projectRequest.findUnique({
      where: { id: projectId },
      include: { uploadedAssets: true },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    // Get image URLs
    const imageUrls = project.uploadedAssets.map(a => a.s3Url);

    // Analyze with Claude
    const analysis = await analyzeProject(project.description, imageUrls);

    // Calculate estimate costs
    const laborCost = analysis.estimatedLabor.hours * analysis.estimatedLabor.rate;
    const materialCost = analysis.materials.reduce((sum, m) => sum + m.total, 0);
    const subtotal = laborCost + materialCost + analysis.travel;
    const overheadCost = subtotal * 0.15;

    const baseEstimate = subtotal + overheadCost;
    const expectedEstimate = baseEstimate * (1 + analysis.profitMargin);
    const lowEstimate = subtotal;
    const highEstimate = expectedEstimate * 1.15;

    // Save estimate
    const estimate = await prisma.estimate.create({
      data: {
        projectId,
        aiAnalysis: analysis,
        scope: analysis.scope,
        complexity: analysis.complexity,
        confidence: analysis.confidence,
        risks: analysis.flagsAndRisks.join("; "),
        laborHours: analysis.estimatedLabor.hours,
        laborRate: analysis.estimatedLabor.rate,
        laborCost,
        materialsJson: analysis.materials,
        materialCost,
        travelCost: analysis.travel,
        overheadCost,
        lowEstimate,
        expectedEstimate,
        highEstimate,
        status: "pending",
      },
    });

    // Update project status
    await prisma.projectRequest.update({
      where: { id: projectId },
      data: { status: "analyzing" },
    });

    return NextResponse.json(estimate);
  } catch (error) {
    console.error("Analysis error:", error);
    return NextResponse.json(
      { error: "Analysis failed" },
      { status: 500 }
    );
  }
}
```

### Step 2: Trigger Analysis After Upload

Edit `/app/api/requests/route.ts` and add at the end of the function (before the response):

```typescript
// Trigger analysis in background
fetch(`${process.env.NEXTAUTH_URL}/api/analyze`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ projectId: projectRequest.id }),
}).catch(err => console.error("Background analysis failed:", err));
```

### Step 3: Send Confirmation Email

Install Resend SDK (already in package.json), then update `/app/api/requests/route.ts`:

```typescript
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// After creating project request, send email:
await resend.emails.send({
  from: `${process.env.NEXT_PUBLIC_COMPANY_NAME} <noreply@resend.dev>`,
  to: email,
  subject: "We Received Your Quote Request",
  html: `
    <h2>Thanks for submitting your project!</h2>
    <p>Reference: <strong>${projectRequest.id}</strong></p>
    <p>We'll analyze your photos and send you an estimate within 24 hours.</p>
  `,
});
```

### Step 4: Create Admin Dashboard

Create `/app/admin/page.tsx`:

```typescript
"use client";

import { useEffect, useState } from "react";

export default function AdminDashboard() {
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchQuotes = async () => {
      const res = await fetch("/api/estimates?status=pending");
      const data = await res.json();
      setQuotes(data);
      setLoading(false);
    };
    fetchQuotes();
  }, []);

  return (
    <div className="max-w-6xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">Quotes Pending Review</h1>
      
      {loading ? (
        <p>Loading...</p>
      ) : quotes.length === 0 ? (
        <p className="text-gray-600">No pending quotes</p>
      ) : (
        <div className="space-y-4">
          {quotes.map(quote => (
            <div key={quote.id} className="border p-4 rounded-lg">
              <h3 className="font-semibold">{quote.project.customer.name}</h3>
              <p className="text-sm text-gray-600">{quote.scope}</p>
              <p className="mt-2">
                <strong>Expected Estimate:</strong> ${quote.expectedEstimate.toLocaleString()}
              </p>
              <button className="mt-3 px-4 py-2 bg-green-600 text-white rounded">
                Review & Approve
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

### Step 5: Deploy Again

```bash
git add .
git commit -m "Add analysis and admin dashboard"
git push
```

Vercel auto-deploys. Check your site after ~2 min.

**✅ NOW:**
- Customer form works
- Photos upload to S3
- Claude analyzes the project
- Estimates generate automatically
- You can see pending quotes in admin area

---

## 📧 Phase 3: Email Delivery (30 min)

### Add send endpoint

Create `/app/api/estimates/approve/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  const { estimateId } = await req.json();

  const estimate = await prisma.estimate.findUnique({
    where: { id: estimateId },
    include: { project: { include: { customer: true } } },
  });

  if (!estimate) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Send email with estimate
  await resend.emails.send({
    from: `${process.env.NEXT_PUBLIC_COMPANY_NAME} <noreply@resend.dev>`,
    to: estimate.project.customer.email,
    subject: `Your Project Estimate – ${estimate.project.category}`,
    html: `
      <h2>Your Project Estimate</h2>
      <p><strong>Scope:</strong> ${estimate.scope}</p>
      <p><strong>Expected Cost:</strong> $${estimate.expectedEstimate.toLocaleString()}</p>
      <p><strong>Estimate Range:</strong> $${estimate.lowEstimate.toLocaleString()} - $${estimate.highEstimate.toLocaleString()}</p>
      <p style="color: #666; font-size: 12px;">Confidence: ${(estimate.confidence * 100).toFixed(0)}%</p>
      <p><a href="${process.env.NEXT_PUBLIC_SITE_URL}" style="color: #0066cc;">Reply or schedule a site visit →</a></p>
    `,
  });

  // Update status
  await prisma.estimate.update({
    where: { id: estimateId },
    data: { status: "sent", sentAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
```

Add approve button to admin dashboard.

---

## 📊 Next: Advanced Features

**When you're ready (Phase 4+):**

- [ ] Customer portal (track quote status)
- [ ] SMS notifications
- [ ] Google Calendar integration
- [ ] QuickBooks sync
- [ ] Analytics (conversion rate, avg quote value)
- [ ] Pricing model training
- [ ] Multi-user admin

---

## 🐛 Quick Troubleshooting

| Problem | Fix |
|---------|-----|
| Form won't submit | Check browser console for errors, verify S3 credentials |
| Images won't upload | Verify AWS S3 bucket exists and is public readable |
| Estimates don't generate | Check Claude API key in Vercel env vars |
| Email won't send | Verify Resend API key, check sender in Resend dashboard |
| Blank admin page | Check `/api/estimates` endpoint exists |

---

## 💬 Real Talk

You now have a **working quote generation system** that:
- ✅ Takes customer requests
- ✅ Analyzes photos with AI
- ✅ Generates intelligent estimates
- ✅ Lets you approve/modify
- ✅ Sends professional emails

This is **Phase 1 complete**. The rest is refinement and integrations.

**Cost so far: $0 (all free tiers)**

---

## What to Do Tomorrow

1. Test it with a real project description + photo
2. Review the admin dashboard estimates
3. Send an estimate to a customer
4. Adjust pricing rates based on your market
5. Start accepting real customer requests

**You're now live. Start collecting quotes!** 🚀

---

Need help? Check `README.md` or `DEPLOYMENT.md`.

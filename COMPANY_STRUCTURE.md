# The Hearth & Hollow — Company Structure & Service Divisions

**Company Name:** The Hearth & Hollow
**Domain:** thehearthhollow.com
**Tagline:** "Crafted for Self-Sufficiency • Built to Last"
**Structure:** Multi-service, multi-team operation
**Status:** MVP deployment (expanding services)
**Growth Plan:** 1 team → 2 teams → specialized crews

---

## 📋 Service Divisions

### Division 1: Mobile Workshop (Team 1) — For Homesteading & Self-Sufficiency
**Services:**
- General Handyman repairs (homestead infrastructure)
- Carpentry (custom work, installations, repairs)
- Woodworking (furniture, custom builds, restoration)
- Fence building (property management)
- Wall repairs (structural maintenance)

**Philosophy:** Building systems and structures that support self-sufficient living
**Equipment:** Mobile workshop on wheels
**Lead:** You (initially)
**Crew Size:** 1-2 people
**Growth:** Can add team members as demand increases

### Division 2: Welding & Metal Fabrication (Team 2 - Future)
**Services:**
- Metal welding and fabrication
- Structural repairs
- Custom metal work
- Gates, railings, decorative elements

**Equipment:** Dedicated welding workshop
**Status:** Coming soon (set up after handyman division stabilizes)
**Crew Size:** 1-2 people (specialized trade)
**Growth:** Can expand as demand grows

### Division 3+: Future Services (Scalable)
**Potential Services:**
- HVAC repairs
- Electrical work (with licensing)
- Plumbing
- Concrete/masonry
- Landscaping
- Roofing
- And more...

**Growth Model:** Add new specialties as team grows and expertise develops

---

## 🏢 Quote System Architecture

The system is designed to scale across all service divisions seamlessly:

```
Mystic Meadows
├── Landing Page (Company overview)
├── Quote System (All divisions)
│   ├── Service Category Selection
│   │   ├─ Handyman
│   │   ├─ Carpentry
│   │   ├─ Woodworking
│   │   ├─ Welding & Metal Fab (when launched)
│   │   └─ [Future services]
│   ├── Photo Upload
│   ├── Description & Details
│   └── AI Estimation
├── Admin Dashboard
│   ├─ All incoming quotes (all divisions)
│   ├─ Filter by service type
│   ├─ Route to appropriate team
│   └─ Track by division
└── Customer Portal
    ├─ Quote tracking
    ├─ Team assignment
    └─ Service history
```

---

## 🎯 Implementation Phases

### Phase 1: Launch (MVP - This Week)
**Divisions:** Handyman, Carpentry, Woodworking
**Team:** You (1 person)
**Categories:**
- General carpentry
- Furniture building
- Deck repair/building
- Fence building
- Wall repair
- Installation work
- Other

**Status:** Ready to deploy TODAY

### Phase 2: Scale Team 1 (Month 1-2)
**Actions:**
- Hire 1-2 team members for mobile workshop
- Add team assignment to admin dashboard
- Create team schedules
- Implement capacity planning

**Status:** Build after initial quotes start coming in

### Phase 3: Add Welding Division (Month 2-3)
**Actions:**
- Set up second workshop (welding)
- Hire/train welding specialist
- Add welding service category
- Create separate pricing for metal work

**Status:** Launch when handyman division stabilizing

### Phase 4: Scale & Diversify (Month 4+)
**Actions:**
- Add more service categories as team grows
- Implement multi-team scheduling
- Create advanced analytics by division
- Optimize pricing per service type

**Status:** Ongoing growth and refinement

---

## 💰 Pricing by Division (MVP)

### Team 1: Handyman, Carpentry, Woodworking
```
Labor: $60/hour (adjustable by service)
Material markup: 25%
Travel: $35 flat (within local service area)
Overhead: 15%
Profit margin: 25-35%

Specialization adjustments:
- Basic handyman: $50-60/hour
- Carpentry: $60-75/hour
- Custom woodworking: $70-85/hour
```

### Team 2: Welding & Metal Fabrication (Future)
```
Labor: $75-90/hour (specialized trade)
Material markup: 30% (higher material costs)
Travel: $50 (equipment transport)
Overhead: 20% (specialized tools)
Profit margin: 30-40%

Note: Welding rates typically higher due to expertise
```

---

## 📱 Service Categories (Current)

**In `.env` and form:**
```
1. General Carpentry
2. Furniture Building
3. Deck Repair/Building
4. Fence Building
5. Wall Repair
6. Welding (visible but not active until Phase 3)
7. Installation
8. Other
```

**You can expand by editing:**
`app/request/page.tsx` line ~10 (`CATEGORIES` array)

---

## 🎨 Branding

**Company:** Mystic Meadows
**Tagline:** "Quality Craftsmanship, Expert Hands"
**Services:** Jack of all trades → Multi-specialized teams

**Visual Identity (Recommendation):**
- Colors: Earth tones (wood, metal, nature)
- Logo: Workshop/meadow themed
- Font: Approachable, professional

---

## 👥 Team Structure (Growth Plan)

### Month 0 (MVP Launch)
```
You
├── Handyman work
├── Carpentry
└── Woodworking
```

### Month 1-2 (Team Growth Phase 1)
```
You (Lead)
├── Team Member 1 (mobile workshop)
│   ├── Handyman
│   ├── Carpentry
│   └── Woodworking
└── You
    ├── Estimates/business
    └── Complex projects
```

### Month 2-3 (Add Welding)
```
Mystic Meadows
├── Mobile Workshop Team
│   ├── Lead: You or Team Lead
│   ├── Team Member 1
│   └── Team Member 2
└── Welding Shop
    ├── Lead: Welding specialist
    └── Assistant (as needed)
```

### Month 4+ (Scale)
```
Mystic Meadows (Owner: You)
├── Operations Manager
├── Mobile Workshop Division
│   ├── Lead
│   ├── Team 1
│   ├── Team 2
│   └── Equipment/scheduling
├── Welding Division
│   ├── Lead
│   ├── Specialist 1
│   ├── Specialist 2
│   └── Materials/supply
└── [Future divisions]
```

---

## 🗓️ Implementation Timeline

| Phase | Timeline | Focus | Team Size |
|-------|----------|-------|-----------|
| **MVP Launch** | Week 1 | Deploy system | 1 (You) |
| **Initial Traction** | Weeks 2-4 | Build customer base | 1 |
| **Team Growth 1** | Month 1-2 | Hire 1-2 assistants | 2-3 |
| **Add Welding** | Month 2-3 | Setup 2nd workshop | 3-5 |
| **Scale & Optimize** | Month 4+ | Multiple teams | 5-10+ |

---

## 📊 Database Structure (Ready for Growth)

The database is already structured to handle multiple teams/divisions:

```sql
-- Current (MVP)
Customers
ProjectRequests
  └─ category: "Carpentry", "Handyman", etc.
Estimates
UploadedAssets

-- When adding teams (Phase 2)
Teams (new table)
TeamMembers (new table)
ProjectRequests
  └─ assignedTeamId (foreign key)

-- When tracking by division (Phase 3)
Divisions (new table)
Teams
  └─ divisionId (foreign key)
ProjectRequests
  └─ divisionId (for tracking)
```

---

## 🎯 Service Categories (Expandable)

**Current MVP Categories:**
```
1. General Carpentry
2. Furniture Building
3. Deck Repair/Building
4. Fence Building
5. Wall Repair
6. Welding
7. Installation
8. Other
```

**To Add (Phase 2+):**
```
- HVAC Repair
- Electrical Work
- Plumbing
- Concrete/Masonry
- Landscaping
- Roofing
- Painting
- Drywall
- Flooring
- [Custom services]
```

**How to Add:**
1. Edit `app/request/page.tsx` line ~10
2. Add category to `CATEGORIES` array
3. Update pricing in `lib/claude-analyzer.ts` if different rate
4. Redeploy
5. Done!

---

## 🔧 Customization Checklist

### Before Launch
- [ ] Set company name: "Mystic Meadows" ✅
- [ ] Add service categories (current ones are good for MVP)
- [ ] Set initial pricing rates ($60/hour for handyman/carpentry)
- [ ] Update colors/styling to match brand
- [ ] Add company logo (optional, can add later)

### After Launch
- [ ] Collect initial quotes
- [ ] Refine pricing based on market
- [ ] Add team members to admin dashboard
- [ ] Create team assignment workflow
- [ ] Add welding category when ready

### Future
- [ ] Add more service categories
- [ ] Implement multi-team scheduling
- [ ] Create division-specific reports
- [ ] Build customer portal
- [ ] Add integrations (calendar, payments, etc.)

---

## 🚀 Growth Roadmap

### Week 1: MVP
- Deploy quote system
- Start accepting quotes
- Test AI estimates

### Weeks 2-4: Validation
- Refine pricing
- Collect feedback
- Adjust service categories

### Month 1-2: Team 1 Growth
- Hire first team member
- Implement team scheduling
- Scale quote volume

### Month 2-3: Add Services
- Launch welding division
- Implement division-specific workflows
- Add more service categories

### Month 3-6: Optimization
- Multi-team management
- Advanced analytics
- Customer portal
- Integrations

### Month 6+: Scale
- Hire specialized teams
- Add new service divisions
- Regional expansion
- Enterprise features

---

## 💡 Key Decision Points

### Q1: Add Welding Division?
**When:** After handyman division is stable (generating 10+ quotes/week)
**Cost:** New equipment + personnel
**Timeline:** 2-3 weeks setup + training

### Q2: Add More Service Categories?
**When:** Team is at capacity for current services
**Cost:** Minimal (just add categories)
**Timeline:** Same day (just edit form)

### Q3: Hire Management?
**When:** Managing 3+ team members becomes time-consuming
**Cost:** Salary or contractor
**Timeline:** Ongoing as you grow

---

## 🎓 System Features Ready for Growth

✅ **Multi-category support** - Add new services anytime
✅ **Scalable database** - Handles teams, divisions, specializations
✅ **Flexible pricing** - Different rates per service
✅ **Photo analysis** - Works for any construction/fabrication project
✅ **Admin dashboard** - Ready to route quotes to teams
✅ **Email integration** - Notify right team member
✅ **Vercel hosting** - Auto-scales with demand

---

## 📞 Support for Growth

As you grow, you can:
- Add more team members to admin dashboard
- Create team-specific pricing rules
- Implement automated routing
- Build customer portals
- Integrate with accounting software
- Add scheduling system
- Create mobile app for field teams

All without replacing the core system - it's built to scale.

---

## 🎉 Ready to Launch

**Company:** Mystic Meadows
**Initial Services:** Handyman, Carpentry, Woodworking
**Team:** You (with growth plan for 2+ teams)
**Growth Path:** Clear roadmap for adding services and team members

**Status:** Ready to deploy TODAY and scale as you grow.

---

**Next Step:** Deploy to Vercel and start accepting Mystic Meadows quotes!

Follow `START_HERE.md` → `QUICK_START.md` → Live in 1 hour.

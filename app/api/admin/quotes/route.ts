import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

// Check if user is authenticated
async function isAuthenticated(req: NextRequest) {
  const cookieStore = await cookies();
  return cookieStore.get('admin_session')?.value === 'authenticated';
}

interface CustomerProfile {
  email: string;
  name: string;
  phone: string;
  quoteCount: number;
  quotes: any[];
  lastQuoteDate: string;
  statuses: {
    submitted: number;
    analyzed: number;
    sent: number;
  };
}

export async function GET(req: NextRequest) {
  try {
    if (!await isAuthenticated(req)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!prisma) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 503 }
      );
    }

    const quotes = await prisma.projectRequest.findMany({
      include: {
        customer: true,
        uploadedAssets: true,
        estimate: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Group by email on the server
    const profilesMap: Record<string, CustomerProfile> = {};

    quotes.forEach((quote) => {
      const email = quote.customer?.email || 'unknown';
      
      if (!profilesMap[email]) {
        profilesMap[email] = {
          email,
          name: quote.customer?.name || 'Unknown',
          phone: quote.customer?.phone || '',
          quoteCount: 0,
          quotes: [],
          lastQuoteDate: '',
          statuses: { submitted: 0, analyzed: 0, sent: 0 },
        };
      }

      profilesMap[email].quoteCount++;
      profilesMap[email].quotes.push(quote);
      profilesMap[email].lastQuoteDate = quote.createdAt.toISOString();

      const status = quote.status as keyof typeof profilesMap[email]['statuses'];
      if (status in profilesMap[email].statuses) {
        profilesMap[email].statuses[status]++;
      }
    });

    // Convert to array and sort
    const profiles = Object.values(profilesMap).sort(
      (a, b) =>
        new Date(b.lastQuoteDate).getTime() -
        new Date(a.lastQuoteDate).getTime()
    );

    return NextResponse.json({
      type: 'grouped',
      profiles,
      totalCustomers: profiles.length,
      totalQuotes: quotes.length,
    });
  } catch (error) {
    console.error('Error fetching quotes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch quotes' },
      { status: 500 }
    );
  }
}

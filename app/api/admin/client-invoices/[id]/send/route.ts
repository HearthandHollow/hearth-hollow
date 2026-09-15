import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import Stripe from 'stripe'
import { verifySessionToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendCustomEmail } from '@/lib/email'
import { getBaseUrl } from '@/lib/site'

export const dynamic = 'force-dynamic'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '')

async function isAuthenticated() {
  const cookieStore = await cookies()
  return verifySessionToken(cookieStore.get('admin_session')?.value)
}

interface LineItem {
  description: string
  amount: number
}

// Emails the invoice to the client with a Stripe Checkout pay link.
// Mirrors the quote-invoice send route: Stripe is best-effort — if session
// creation fails, the invoice email still goes out without the pay button.
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!prisma) return NextResponse.json({ error: 'No database' }, { status: 503 })

    const invoice = await prisma.clientInvoice.findUnique({
      where: { id: params.id },
      include: { client: true },
    })
    if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (invoice.status === 'paid') {
      return NextResponse.json({ error: 'Invoice is already paid' }, { status: 400 })
    }
    if (!invoice.client.email) {
      return NextResponse.json(
        { error: 'This client has no email address on file — add one on their profile first' },
        { status: 400 }
      )
    }

    const baseUrl = getBaseUrl()
    let payUrl: string | null = null
    let stripeSessionId: string | null = invoice.stripeSessionId

    if (process.env.STRIPE_SECRET_KEY) {
      try {
        const session = await stripe.checkout.sessions.create({
          mode: 'payment',
          customer_email: invoice.client.email,
          line_items: [
            {
              price_data: {
                currency: 'usd',
                product_data: {
                  name: `${invoice.client.businessName} — ${invoice.periodLabel}`,
                  description: `Invoice ${invoice.invoiceNumber} from Hearth & Hollow`,
                },
                unit_amount: Math.round(invoice.total * 100),
              },
              quantity: 1,
            },
          ],
          metadata: {
            type: 'client_invoice',
            clientInvoiceId: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
          },
          success_url: `${baseUrl}/?invoice_paid=true`,
          cancel_url: `${baseUrl}/`,
        })
        payUrl = session.url
        stripeSessionId = session.id
      } catch (err) {
        console.error('Stripe session creation failed for client invoice:', err)
      }
    }

    const lineItems = (invoice.lineItems as unknown as LineItem[]) || []
    const rows = lineItems
      .map(
        (li) =>
          `<tr><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${li.description}</td><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">$${li.amount.toFixed(2)}</td></tr>`
      )
      .join('')

    const html = `
      <div style="font-family:system-ui,-apple-system,sans-serif;max-width:600px;margin:0 auto;color:#1f2937;">
        <h2 style="color:#78350f;">Invoice ${invoice.invoiceNumber}</h2>
        <p>Hi ${invoice.client.contactName || invoice.client.businessName},</p>
        <p>Here is your invoice from Hearth &amp; Hollow for <strong>${invoice.periodLabel}</strong>.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          ${rows}
          <tr><td style="padding:10px 12px;font-weight:bold;">Total</td><td style="padding:10px 12px;text-align:right;font-weight:bold;">$${invoice.total.toFixed(2)}</td></tr>
        </table>
        ${invoice.notes ? `<p style="color:#6b7280;">${invoice.notes}</p>` : ''}
        ${
          payUrl
            ? `<p style="margin:24px 0;"><a href="${payUrl}" style="background:#ea580c;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Pay Invoice Online</a></p>`
            : ''
        }
        <p>Questions? Just reply to this email.</p>
        <p style="color:#6b7280;">— Hearth &amp; Hollow</p>
      </div>
    `

    await sendCustomEmail(
      invoice.client.email,
      `Invoice ${invoice.invoiceNumber} — Hearth & Hollow (${invoice.periodLabel})`,
      html
    )

    const updated = await prisma.clientInvoice.update({
      where: { id: invoice.id },
      data: { status: 'sent', sentAt: new Date(), stripeSessionId },
    })

    return NextResponse.json({ invoice: updated, payLinkIncluded: !!payUrl })
  } catch (error) {
    console.error('Error sending client invoice:', error)
    return NextResponse.json({ error: 'Failed to send invoice' }, { status: 500 })
  }
}

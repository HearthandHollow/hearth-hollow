import PDFDocument from "pdfkit";

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface InvoicePdfData {
  invoiceNumber: string;
  createdAt: Date;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  projectId: string;
  category: string;
  location?: string;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  total: number;
  notes?: string;
}

const BUSINESS_NAME = "The Hearth & Hollow";
const BUSINESS_EMAIL = "support@thehearthhollow.com";

export function generateInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "LETTER", margin: 50 });
      const chunks: Buffer[] = [];

      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", (err) => reject(err));

      // Header
      doc
        .fontSize(22)
        .fillColor("#78350f")
        .text(BUSINESS_NAME, { continued: false });
      doc
        .fontSize(10)
        .fillColor("#6b7280")
        .text(BUSINESS_EMAIL)
        .moveDown(1);

      doc
        .fontSize(18)
        .fillColor("#1f2937")
        .text("INVOICE", { align: "right" });
      doc
        .fontSize(10)
        .fillColor("#6b7280")
        .text(`Invoice #: ${data.invoiceNumber}`, { align: "right" })
        .text(`Date: ${data.createdAt.toLocaleDateString("en-US")}`, { align: "right" })
        .text(`Project Ref: ${data.projectId}`, { align: "right" })
        .moveDown(1.5);

      // Bill To
      doc.fontSize(12).fillColor("#1f2937").text("Bill To:", { underline: false });
      doc.fontSize(10).fillColor("#374151");
      doc.text(data.customerName);
      doc.text(data.customerEmail);
      if (data.customerPhone) doc.text(data.customerPhone);
      doc.moveDown(0.5);
      doc.fontSize(10).fillColor("#6b7280").text(`Project: ${data.category}`);
      if (data.location) doc.text(`Location: ${data.location}`);
      doc.moveDown(1.5);

      // Table header
      const tableTop = doc.y;
      const col = { desc: 50, qty: 320, price: 390, total: 470 };

      doc
        .fontSize(10)
        .fillColor("#ffffff")
        .rect(50, tableTop, 512, 20)
        .fill("#78350f");

      doc
        .fillColor("#ffffff")
        .text("Description", col.desc + 5, tableTop + 5)
        .text("Qty", col.qty, tableTop + 5)
        .text("Unit Price", col.price, tableTop + 5)
        .text("Total", col.total, tableTop + 5);

      let y = tableTop + 20;
      doc.fillColor("#1f2937");

      data.lineItems.forEach((item, i) => {
        const rowHeight = 20;
        if (i % 2 === 1) {
          doc.rect(50, y, 512, rowHeight).fill("#f9fafb");
          doc.fillColor("#1f2937");
        }
        doc
          .fontSize(9)
          .text(item.description, col.desc + 5, y + 5, { width: 260 })
          .text(String(item.quantity), col.qty, y + 5)
          .text(`$${item.unitPrice.toFixed(2)}`, col.price, y + 5)
          .text(`$${item.total.toFixed(2)}`, col.total, y + 5);
        y += rowHeight;

        // Page break safety
        if (y > 680) {
          doc.addPage();
          y = 50;
        }
      });

      y += 10;
      doc.moveTo(50, y).lineTo(562, y).strokeColor("#e5e7eb").stroke();
      y += 10;

      doc
        .fontSize(10)
        .fillColor("#6b7280")
        .text("Subtotal:", col.price, y)
        .text(`$${data.subtotal.toFixed(2)}`, col.total, y);
      y += 18;

      doc
        .fontSize(13)
        .fillColor("#1f2937")
        .text("Total:", col.price, y, { underline: false })
        .text(`$${data.total.toFixed(2)}`, col.total, y);
      y += 30;

      if (data.notes) {
        doc.fontSize(10).fillColor("#6b7280").text("Notes:", 50, y);
        y += 14;
        doc.fontSize(9).fillColor("#374151").text(data.notes, 50, y, { width: 512 });
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

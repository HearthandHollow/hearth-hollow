'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

interface Quote {
  id: string;
  customerId: string;
  category: string;
  location: string;
  timeline: string;
  description: string;
  status: string;
  approvalStatus: string;
  createdAt: string;
  emailSentAt?: string;
  clientApprovedAt?: string;
  clientDeniedAt?: string;
  scheduledDate?: string | null;
  scheduledSlot?: string | null;
  customer?: {
    name: string;
    email: string;
    phone: string;
  };
  uploadedAssets?: Array<{
    id: string;
    filename: string;
    s3Url: string;
    mimeType: string;
  }>;
  estimate?: {
    id: string;
    lowEstimate: number;
    expectedEstimate: number;
    highEstimate: number;
    breakdown: string;
    confidence: number;
    materialRequirements?: string;
    materialList?: MaterialItem[];
    timeEstimation?: string;
    isEdited?: boolean;
    selectedTier?: 'low' | 'expected' | 'high';
    depositAmount?: number;
  };
}

interface MaterialItem {
  item: string;
  quantity: number;
  unit: string;
  estimatedPrice: number;
}

interface AssetWithSignedUrl {
  id: string;
  filename: string;
  s3Url: string;
  mimeType: string;
  signedUrl?: string;
  signedUrlError?: string;
}

interface EmailMsg {
  id: string;
  from: string;
  to: string;
  date: string;
  subject: string;
  snippet: string;
  body: string;
}

interface EmailAnalysis {
  summary: string;
  requestedChanges: string[];
  newDetails: string[];
  suggestedEstimate: { low: number; expected: number; high: number } | null;
  reasoning: string;
}

export default function QuoteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const quoteId = params.id as string;

  const [quote, setQuote] = useState<Quote | null>(null);
  const [assetsWithUrls, setAssetsWithUrls] = useState<AssetWithSignedUrl[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingEstimate, setIsEditingEstimate] = useState(false);
  const [editData, setEditData] = useState({
    description: '',
    category: '',
    location: '',
    timeline: '',
  });
  const [estimateEditData, setEstimateEditData] = useState({
    lowEstimate: 0,
    expectedEstimate: 0,
    highEstimate: 0,
    breakdown: '',
    materialRequirements: '',
    timeEstimation: '',
    materialList: [] as MaterialItem[],
    depositAmount: 0,
  });
  const [savingTier, setSavingTier] = useState(false);
  const [imageLoadErrors, setImageLoadErrors] = useState<Record<string, boolean>>({});
  const [changingStatus, setChangingStatus] = useState(false);
  const [includePhotos, setIncludePhotos] = useState(false);
  const [emails, setEmails] = useState<EmailMsg[]>([]);
  const [emailsConfigured, setEmailsConfigured] = useState(true);
  const [emailsLoading, setEmailsLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [analyzingEmails, setAnalyzingEmails] = useState(false);
  const [emailAnalysis, setEmailAnalysis] = useState<EmailAnalysis | null>(null);
  const [scheduleEditing, setScheduleEditing] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleSlot, setScheduleSlot] = useState<'morning' | 'afternoon'>('morning');
  const [savingSchedule, setSavingSchedule] = useState(false);

  interface InvoiceLineItem {
    description: string;
    quantity: number;
    unitPrice: number;
  }
  interface InvoiceData {
    id: string;
    invoiceNumber: string;
    lineItems: { description: string; quantity: number; unitPrice: number; total: number }[];
    subtotal: number;
    total: number;
    status: string;
    sentAt?: string | null;
  }

  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [invoiceLoading, setInvoiceLoading] = useState(true);
  const [showInvoiceEditor, setShowInvoiceEditor] = useState(false);
  const [invoiceLineItems, setInvoiceLineItems] = useState<InvoiceLineItem[]>([]);
  const [invoiceNotes, setInvoiceNotes] = useState('');
  const [savingInvoice, setSavingInvoice] = useState(false);
  const [sendingInvoice, setSendingInvoice] = useState(false);
  const [invoiceError, setInvoiceError] = useState('');
  const [invoiceSentMsg, setInvoiceSentMsg] = useState('');
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState('');

  useEffect(() => {
    fetchQuote();
  }, [quoteId]);

  useEffect(() => {
    fetchEmails();
  }, [quoteId]);

  useEffect(() => {
    fetchInvoice();
  }, [quoteId]);

  // Keep the estimate edit form in sync with whatever the server currently
  // has stored. Called after every fetch/analyze/save so "Edit Estimate"
  // never opens to stale or blank fields.
  const syncEstimateEditData = (estimate: any) => {
    setEstimateEditData({
      lowEstimate: estimate.lowEstimate,
      expectedEstimate: estimate.expectedEstimate,
      highEstimate: estimate.highEstimate,
      breakdown: estimate.breakdown,
      materialRequirements: estimate.materialRequirements || '',
      timeEstimation: estimate.timeEstimation || '',
      materialList: Array.isArray(estimate.materialList) ? estimate.materialList : [],
      depositAmount: estimate.depositAmount || 0,
    });
  };

  const fetchQuote = async () => {
    try {
      const response = await fetch(`/api/admin/quotes/${quoteId}`);
      if (response.status === 401) {
        router.push('/admin');
        return;
      }
      if (!response.ok) throw new Error('Failed to fetch quote');
      const data = await response.json();
      setQuote(data);
      setEditData({
        description: data.description,
        category: data.category,
        location: data.location,
        timeline: data.timeline,
      });

      // Initialize estimate edit data
      if (data.estimate) {
        syncEstimateEditData(data.estimate);
      }

      // Initialize schedule edit fields
      if (data.scheduledDate) {
        setScheduleDate(String(data.scheduledDate).slice(0, 10));
        setScheduleSlot(data.scheduledSlot === 'afternoon' ? 'afternoon' : 'morning');
      }

      // Generate signed URLs for assets
      if (data.uploadedAssets && data.uploadedAssets.length > 0) {
        const withUrls = await Promise.all(
          data.uploadedAssets.map(async (asset: any) => {
            try {
              const signResponse = await fetch(`/api/admin/quotes/${quoteId}/get-signed-url`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ s3Key: asset.s3Url }),
              });

              if (signResponse.ok) {
                const { signedUrl } = await signResponse.json();
                return { ...asset, signedUrl };
              } else {
                return { ...asset, signedUrlError: 'Failed to generate signed URL' };
              }
            } catch (err) {
              console.error('Error generating signed URL:', err);
              return { ...asset, signedUrlError: String(err) };
            }
          })
        );

        setAssetsWithUrls(withUrls);
      }
    } catch (err) {
      setError('Failed to load quote');
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/quotes/${quoteId}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ includePhotos }),
      });
      if (!response.ok) throw new Error('Analysis failed');
      const data = await response.json();
      setQuote(data);
      if (data.estimate) {
        syncEstimateEditData(data.estimate);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze quote');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSaveEdits = async () => {
    try {
      const response = await fetch(`/api/admin/quotes/${quoteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editData),
      });
      if (!response.ok) throw new Error('Failed to save changes');
      const data = await response.json();
      setQuote(data);
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    }
  };

  const handleSendEstimate = async () => {
    try {
      const response = await fetch(`/api/admin/quotes/${quoteId}/send`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to send estimate');
      const data = await response.json();
      setQuote(data);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send estimate');
    }
  };

  const handleImageError = (assetId: string) => {
    setImageLoadErrors(prev => ({ ...prev, [assetId]: true }));
  };

  const handleDeleteQuote = async () => {
    if (!window.confirm('Are you sure you want to delete this quote? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/quotes/${quoteId}/delete`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete quote');
      setError('');
      // Redirect to dashboard after successful deletion
      router.push('/admin/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete quote');
    }
  };

  const handleSaveEstimate = async () => {
    try {
      const response = await fetch(`/api/admin/quotes/${quoteId}/estimate`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(estimateEditData),
      });
      if (!response.ok) throw new Error('Failed to save estimate');
      const data = await response.json();
      setQuote(prev => prev ? { ...prev, estimate: data } : null);
      syncEstimateEditData(data);
      setIsEditingEstimate(false);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save estimate');
    }
  };

  const handleSelectTier = async (tier: 'low' | 'expected' | 'high') => {
    if (!quote?.estimate || savingTier) return;
    setSavingTier(true);
    try {
      const response = await fetch(`/api/admin/quotes/${quoteId}/estimate`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectedTier: tier }),
      });
      if (!response.ok) throw new Error('Failed to update selected tier');
      const data = await response.json();
      setQuote(prev => prev ? { ...prev, estimate: data } : null);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update selected tier');
    } finally {
      setSavingTier(false);
    }
  };

  const addMaterialRow = () => {
    setEstimateEditData(prev => ({
      ...prev,
      materialList: [...prev.materialList, { item: '', quantity: 1, unit: 'unit', estimatedPrice: 0 }],
    }));
  };

  const updateMaterialRow = (index: number, field: keyof MaterialItem, value: string) => {
    setEstimateEditData(prev => {
      const next = [...prev.materialList];
      const row = { ...next[index] };
      if (field === 'quantity' || field === 'estimatedPrice') {
        (row[field] as number) = parseFloat(value) || 0;
      } else {
        (row[field] as string) = value;
      }
      next[index] = row;
      return { ...prev, materialList: next };
    });
  };

  const removeMaterialRow = (index: number) => {
    setEstimateEditData(prev => ({
      ...prev,
      materialList: prev.materialList.filter((_, i) => i !== index),
    }));
  };

  const handleChangeStatus = async (newStatus: string) => {
    setChangingStatus(true);
    try {
      const response = await fetch(`/api/admin/quotes/${quoteId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvalStatus: newStatus }),
      });
      if (!response.ok) throw new Error('Failed to update status');
      const data = await response.json();
      setQuote(data);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setChangingStatus(false);
    }
  };

  const fetchEmails = async () => {
    setEmailsLoading(true);
    setEmailError('');
    try {
      const res = await fetch(`/api/admin/quotes/${quoteId}/emails`);
      if (res.status === 401) {
        router.push('/admin');
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load conversation');
      setEmailsConfigured(data.configured !== false);
      setEmails(data.messages || []);
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : 'Failed to load conversation');
    } finally {
      setEmailsLoading(false);
    }
  };

  const handleSendReply = async () => {
    if (!replyText.trim()) return;
    setSendingReply(true);
    setEmailError('');
    try {
      const res = await fetch(`/api/admin/quotes/${quoteId}/emails/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: replyText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send reply');
      setEmails(data.messages || emails);
      setReplyText('');
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : 'Failed to send reply');
    } finally {
      setSendingReply(false);
    }
  };

  const handleAnalyzeEmails = async () => {
    setAnalyzingEmails(true);
    setEmailError('');
    setEmailAnalysis(null);
    try {
      const res = await fetch(`/api/admin/quotes/${quoteId}/emails/analyze`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to analyze conversation');
      setEmailAnalysis(data);
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : 'Failed to analyze conversation');
    } finally {
      setAnalyzingEmails(false);
    }
  };

  const applySuggestedEstimate = () => {
    if (!emailAnalysis?.suggestedEstimate) return;
    setEstimateEditData({
      ...estimateEditData,
      lowEstimate: emailAnalysis.suggestedEstimate.low,
      expectedEstimate: emailAnalysis.suggestedEstimate.expected,
      highEstimate: emailAnalysis.suggestedEstimate.high,
    });
    setIsEditingEstimate(true);
  };

  const handleSaveSchedule = async () => {
    if (!scheduleDate) return;
    setSavingSchedule(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/quotes/${quoteId}/schedule`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: scheduleDate, slot: scheduleSlot }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update schedule');
      setQuote(data);
      setScheduleEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update schedule');
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleClearSchedule = async () => {
    if (!window.confirm('Remove the scheduled date for this quote?')) return;
    setSavingSchedule(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/quotes/${quoteId}/schedule`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to clear schedule');
      setQuote(data);
      setScheduleDate('');
      setScheduleEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear schedule');
    } finally {
      setSavingSchedule(false);
    }
  };

  const fetchInvoice = async () => {
    setInvoiceLoading(true);
    try {
      const res = await fetch(`/api/admin/quotes/${quoteId}/invoice`);
      if (res.status === 401) return;
      const data = await res.json();
      if (data.invoice) {
        setInvoice(data.invoice);
        setInvoiceLineItems(
          data.invoice.lineItems.map((li: any) => ({
            description: li.description,
            quantity: li.quantity,
            unitPrice: li.unitPrice,
          }))
        );
      }
    } catch (err) {
      // Non-fatal — invoice section will just start empty.
    } finally {
      setInvoiceLoading(false);
    }
  };

  const buildDefaultLineItems = (): InvoiceLineItem[] => {
    const materials = quote?.estimate?.materialList || [];
    const materialLines: InvoiceLineItem[] = materials.map((m) => ({
      description: m.item,
      quantity: m.quantity,
      unitPrice: m.estimatedPrice,
    }));
    const materialTotal = materialLines.reduce((sum, li) => sum + li.quantity * li.unitPrice, 0);

    const tier = quote?.estimate?.selectedTier || 'expected';
    const tierAmount = quote?.estimate
      ? tier === 'low'
        ? quote.estimate.lowEstimate
        : tier === 'high'
        ? quote.estimate.highEstimate
        : quote.estimate.expectedEstimate
      : 0;

    const laborAmount = Math.max(tierAmount - materialTotal, 0);
    const laborLine: InvoiceLineItem = {
      description: 'Labor',
      quantity: 1,
      unitPrice: laborAmount,
    };

    return [...materialLines, laborLine];
  };

  const handleOpenInvoiceEditor = () => {
    if (invoiceLineItems.length === 0) {
      setInvoiceLineItems(buildDefaultLineItems());
    }
    setShowInvoiceEditor(true);
    setInvoiceSentMsg('');
  };

  // "Create Invoice" — one click: builds the invoice from the estimate,
  // saves it, and shows the PDF preview immediately. No editor step
  // required first; use "Edit Invoice" afterward to tweak line items.
  const handleCreateInvoice = async () => {
    const items = invoiceLineItems.length > 0 ? invoiceLineItems : buildDefaultLineItems();
    setInvoiceLineItems(items);
    setSavingInvoice(true);
    setInvoiceError('');
    setInvoiceSentMsg('');
    try {
      const res = await fetch(`/api/admin/quotes/${quoteId}/invoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineItems: items, notes: invoiceNotes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create invoice');
      setInvoice(data.invoice);
      setPdfPreviewUrl(`/api/admin/quotes/${quoteId}/invoice/pdf?t=${Date.now()}`);
    } catch (err) {
      setInvoiceError(err instanceof Error ? err.message : 'Failed to create invoice');
    } finally {
      setSavingInvoice(false);
    }
  };

  const addInvoiceRow = () => {
    setInvoiceLineItems((prev) => [...prev, { description: '', quantity: 1, unitPrice: 0 }]);
  };

  const updateInvoiceRow = (index: number, field: keyof InvoiceLineItem, value: string) => {
    setInvoiceLineItems((prev) => {
      const next = [...prev];
      const row = { ...next[index] };
      if (field === 'quantity' || field === 'unitPrice') {
        (row[field] as number) = parseFloat(value) || 0;
      } else {
        (row[field] as string) = value;
      }
      next[index] = row;
      return next;
    });
  };

  const removeInvoiceRow = (index: number) => {
    setInvoiceLineItems((prev) => prev.filter((_, i) => i !== index));
  };

  const invoiceTotal = invoiceLineItems.reduce((sum, li) => sum + li.quantity * li.unitPrice, 0);

  const handleSaveAndPreviewInvoice = async () => {
    setSavingInvoice(true);
    setInvoiceError('');
    try {
      const res = await fetch(`/api/admin/quotes/${quoteId}/invoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineItems: invoiceLineItems, notes: invoiceNotes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save invoice');
      setInvoice(data.invoice);
      // Preview inline on this page rather than opening/downloading a new
      // tab. Cache-bust so the iframe always reflects the just-saved version.
      setPdfPreviewUrl(`/api/admin/quotes/${quoteId}/invoice/pdf?t=${Date.now()}`);
      // Close the editor automatically so the Email button (which only
      // shows outside the editor) is available right away — no separate
      // "Close" click required before emailing.
      setShowInvoiceEditor(false);
    } catch (err) {
      setInvoiceError(err instanceof Error ? err.message : 'Failed to save invoice');
    } finally {
      setSavingInvoice(false);
    }
  };

  const handleEmailInvoice = async () => {
    setSendingInvoice(true);
    setInvoiceError('');
    setInvoiceSentMsg('');
    try {
      const res = await fetch(`/api/admin/quotes/${quoteId}/invoice/send`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to email invoice');
      setInvoice(data.invoice);
      setInvoiceSentMsg('Invoice emailed to customer.');
    } catch (err) {
      setInvoiceError(err instanceof Error ? err.message : 'Failed to email invoice');
    } finally {
      setSendingInvoice(false);
    }
  };

  const formatScheduled = (iso: string) =>
    new Date(`${String(iso).slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    });

  if (loading) {
    return (
      <div className="min-h-screen bg-themeBg p-6">
        <p className="text-themeMuted">Loading quote...</p>
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="min-h-screen bg-themeBg p-6">
        <p className="text-red-600">Quote not found</p>
      </div>
    );
  }

  const CATEGORIES = [
    "General Carpentry",
    "Furniture Building",
    "Deck Repair/Building",
    "Fence Building",
    "Wall Repair",
    "Welding",
    "Installation",
    "Other",
  ];

  const TIMELINES = [
    "ASAP",
    "1-2 weeks",
    "2-4 weeks",
    "1-2 months",
    "Flexible",
  ];

  return (
    <div className="min-h-screen bg-themeBg py-6 sm:py-12 px-3 sm:px-4">
      <div className="max-w-4xl mx-auto">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* Quote Header */}
        <div className="bg-white rounded-lg shadow-md p-4 sm:p-8 mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start gap-3 mb-4">
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold mb-2 break-words">Quote #{quote.id.substring(0, 8)}</h1>
              <p className="text-themeMuted">Status: <span className="font-semibold capitalize">{quote.status}</span></p>
              {quote.scheduledDate && (
                <p className="text-themeMuted mt-1">
                  📅 Scheduled:{' '}
                  <span className="font-semibold">
                    {new Date(`${quote.scheduledDate.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                      timeZone: 'UTC',
                    })}
                  </span>
                  {quote.scheduledSlot ? ` — ${quote.scheduledSlot === 'afternoon' ? 'Afternoon' : 'Morning'}` : ''}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {quote.status !== 'sent' && (
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent"
                >
                  {isEditing ? 'Cancel Edit' : 'Edit Details'}
                </button>
              )}
              <button
                onClick={handleDeleteQuote}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Delete Quote
              </button>
            </div>
          </div>

          {/* Approval Status Section */}
          <div className="border-t pt-4">
            <p className="text-sm font-semibold text-themeMuted mb-3">Approval Status: <span className="capitalize">{quote.approvalStatus?.replace('_', ' ')}</span></p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleChangeStatus('awaiting_analysis')}
                disabled={changingStatus}
                className={`px-3 py-1 rounded text-sm font-medium ${
                  quote.approvalStatus === 'awaiting_analysis'
                    ? 'bg-accent text-white'
                    : 'bg-gray-200 text-themeMuted hover:bg-gray-300'
                }`}
              >
                ⏳ Awaiting Analysis
              </button>
              <button
                onClick={() => handleChangeStatus('awaiting_client_approval')}
                disabled={changingStatus}
                className={`px-3 py-1 rounded text-sm font-medium ${
                  quote.approvalStatus === 'awaiting_client_approval'
                    ? 'bg-brand text-white'
                    : 'bg-gray-200 text-themeMuted hover:bg-gray-300'
                }`}
              >
                ⏱️ Waiting Client Approval
              </button>
              <button
                onClick={() => handleChangeStatus('active')}
                disabled={changingStatus}
                className={`px-3 py-1 rounded text-sm font-medium ${
                  quote.approvalStatus === 'active'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-200 text-themeMuted hover:bg-gray-300'
                }`}
              >
                ✓ Active Job
              </button>
              <button
                onClick={() => handleChangeStatus('denied')}
                disabled={changingStatus}
                className={`px-3 py-1 rounded text-sm font-medium ${
                  quote.approvalStatus === 'denied'
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-200 text-themeMuted hover:bg-gray-300'
                }`}
              >
                ✕ Denied Quote
              </button>
            </div>
          </div>
        </div>

        {/* Customer Info */}
        <div className="bg-white rounded-lg shadow-md p-4 sm:p-8 mb-6">
          <h2 className="text-xl font-bold mb-4">Customer Information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="min-w-0">
              <p className="text-sm text-themeMuted">Name</p>
              <p className="font-semibold break-words">{quote.customer?.name}</p>
            </div>
            <div className="min-w-0">
              <p className="text-sm text-themeMuted">Email</p>
              <p className="font-semibold break-words">{quote.customer?.email}</p>
            </div>
            <div className="min-w-0">
              <p className="text-sm text-themeMuted">Phone</p>
              <p className="font-semibold break-words">{quote.customer?.phone}</p>
            </div>
          </div>
        </div>

        {/* Appointment / Schedule */}
        <div className="bg-white rounded-lg shadow-md p-4 sm:p-8 mb-6">
          <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
            <h2 className="text-xl font-bold">Appointment</h2>
            {!scheduleEditing && (
              <button
                onClick={() => setScheduleEditing(true)}
                className="px-4 py-2 bg-brand text-white rounded-lg hover:bg-brandDark text-sm font-semibold"
              >
                {quote.scheduledDate ? 'Reschedule' : 'Set date'}
              </button>
            )}
          </div>

          {!scheduleEditing ? (
            quote.scheduledDate ? (
              <p className="text-themeMuted">
                {formatScheduled(quote.scheduledDate)}
                {quote.scheduledSlot ? ` — ${quote.scheduledSlot === 'afternoon' ? 'Afternoon' : 'Morning'}` : ''}
              </p>
            ) : (
              <p className="text-themeMuted">Not scheduled yet.</p>
            )
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-2">Date</label>
                <input
                  type="date"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  className="px-3 py-2 border border-themeBorder rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">Time of day</label>
                <div className="flex gap-2">
                  {(['morning', 'afternoon'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setScheduleSlot(s)}
                      className={`px-4 py-2 rounded-lg border text-sm font-medium ${
                        scheduleSlot === s
                          ? 'bg-brand text-white border-brand'
                          : 'bg-white text-themeMuted border-themeBorder hover:border-brand'
                      }`}
                    >
                      {s === 'morning' ? 'Morning' : 'Afternoon'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleSaveSchedule}
                  disabled={savingSchedule || !scheduleDate}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-semibold"
                >
                  {savingSchedule ? 'Saving…' : 'Save date'}
                </button>
                {quote.scheduledDate && (
                  <button
                    onClick={handleClearSchedule}
                    disabled={savingSchedule}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm font-semibold"
                  >
                    Clear date
                  </button>
                )}
                <button
                  onClick={() => setScheduleEditing(false)}
                  disabled={savingSchedule}
                  className="px-4 py-2 bg-gray-300 text-themeMuted rounded-lg hover:bg-gray-400 text-sm font-semibold"
                >
                  Cancel
                </button>
              </div>
              <p className="text-xs text-themeMuted">
                Admin override — this isn&apos;t limited to your normal availability. Booking a date already taken by another job is blocked.
              </p>
            </div>
          )}
        </div>

        {/* Project Details - Edit Mode */}
        {isEditing && (
          <div className="bg-white rounded-lg shadow-md p-4 sm:p-8 mb-6 border-2 border-accent">
            <h2 className="text-xl font-bold mb-4">Edit Project Details</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-2">Category</label>
                <select
                  value={editData.category}
                  onChange={(e) => setEditData({ ...editData, category: e.target.value })}
                  className="w-full px-4 py-2 border border-themeBorder rounded-lg"
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">Location</label>
                <input
                  type="text"
                  value={editData.location}
                  onChange={(e) => setEditData({ ...editData, location: e.target.value })}
                  className="w-full px-4 py-2 border border-themeBorder rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">Timeline</label>
                <select
                  value={editData.timeline}
                  onChange={(e) => setEditData({ ...editData, timeline: e.target.value })}
                  className="w-full px-4 py-2 border border-themeBorder rounded-lg"
                >
                  <option value="">Select Timeline</option>
                  {TIMELINES.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">Description</label>
                <textarea
                  value={editData.description}
                  onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                  rows={6}
                  className="w-full px-4 py-2 border border-themeBorder rounded-lg"
                />
              </div>
              <button
                onClick={handleSaveEdits}
                className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold"
              >
                Save Changes
              </button>
            </div>
          </div>
        )}

        {/* Project Details - View Mode */}
        {!isEditing && (
          <div className="bg-white rounded-lg shadow-md p-4 sm:p-8 mb-6">
            <h2 className="text-xl font-bold mb-4">Project Details</h2>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-themeMuted">Category</p>
                <p className="font-semibold">{quote.category}</p>
              </div>
              <div>
                <p className="text-sm text-themeMuted">Location</p>
                <p className="font-semibold">{quote.location || 'Not specified'}</p>
              </div>
              <div>
                <p className="text-sm text-themeMuted">Timeline</p>
                <p className="font-semibold">{quote.timeline || 'Not specified'}</p>
              </div>
              <div>
                <p className="text-sm text-themeMuted">Description</p>
                <p className="text-themeMuted whitespace-pre-wrap mt-1">{quote.description}</p>
              </div>
            </div>
          </div>
        )}

        {/* Uploaded Photos */}
        {assetsWithUrls && assetsWithUrls.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-4 sm:p-8 mb-6">
            <h2 className="text-xl font-bold mb-4">Uploaded Files ({assetsWithUrls.length})</h2>
            <div className="space-y-3">
              {assetsWithUrls.map((asset) => {
                const hasError = imageLoadErrors[asset.id];
                const displayUrl = asset.signedUrl || asset.s3Url;

                return (
                  <div key={asset.id} className="border border-themeBorder rounded-lg p-4 min-w-0 overflow-hidden">
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-themeText break-words break-all">{asset.filename}</p>
                        <p className="text-xs text-themeMuted mt-1">Type: {asset.mimeType}</p>
                        {asset.signedUrlError && (
                          <p className="text-xs text-red-600 mt-1">Error: {asset.signedUrlError}</p>
                        )}
                      </div>
                      <div className="sm:ml-4 flex gap-2 flex-shrink-0">
                        <a
                          href={displayUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1 bg-accent text-white rounded text-sm hover:bg-accent"
                        >
                          Open
                        </a>
                        <a
                          href={displayUrl}
                          download
                          className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                        >
                          Download
                        </a>
                      </div>
                    </div>
                    
                    {/* Try to show image preview */}
                    {asset.mimeType.startsWith('image/') && !hasError && asset.signedUrl && (
                      <div className="mt-3">
                        <img
                          src={asset.signedUrl}
                          alt={asset.filename}
                          className="max-w-full sm:max-w-xs h-auto rounded border border-themeBorder"
                          onError={() => handleImageError(asset.id)}
                        />
                      </div>
                    )}
                    
                    {hasError && (
                      <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-700">
                        ⚠️ Image preview failed to load.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Estimate Section */}
        <div className="bg-white rounded-lg shadow-md p-4 sm:p-8 mb-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4">
            <h2 className="text-xl font-bold">AI Analysis {quote.estimate?.isEdited && <span className="text-sm text-brand">(Edited)</span>}</h2>
            <div className="flex flex-wrap gap-2">
              {quote.estimate && !isEditingEstimate && (
                <button
                  onClick={() => {
                    syncEstimateEditData(quote.estimate);
                    setIsEditingEstimate(true);
                  }}
                  className="px-4 py-2 bg-brand text-white rounded-lg hover:bg-brandDark font-semibold"
                >
                  Edit Estimate
                </button>
              )}
              {assetsWithUrls.some((a) => a.mimeType?.startsWith('image/')) && (
                <label className="flex items-center gap-2 text-sm text-themeMuted select-none mr-2">
                  <input
                    type="checkbox"
                    checked={includePhotos}
                    onChange={(e) => setIncludePhotos(e.target.checked)}
                    className="rounded border-themeBorder"
                  />
                  Include photos
                </label>
              )}
              <button
                onClick={handleAnalyze}
                disabled={analyzing || isEditing || isEditingEstimate}
                className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent disabled:opacity-50 font-semibold"
              >
                {analyzing ? 'Analyzing...' : quote.estimate ? 'Re-Analyze' : 'Analyze'}
              </button>
            </div>
          </div>

          {isEditingEstimate && quote.estimate && (
            <div className="mb-6 p-6 bg-amber-50 border-2 border-brand rounded-lg">
              <h3 className="text-lg font-bold mb-4 text-brandDark">Edit Estimate Details</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-semibold mb-2">Low Estimate ($)</label>
                    <input
                      type="number"
                      value={estimateEditData.lowEstimate}
                      onChange={(e) => setEstimateEditData({ ...estimateEditData, lowEstimate: parseFloat(e.target.value) })}
                      className="w-full px-3 py-2 border border-themeBorder rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2">Expected Cost ($)</label>
                    <input
                      type="number"
                      value={estimateEditData.expectedEstimate}
                      onChange={(e) => setEstimateEditData({ ...estimateEditData, expectedEstimate: parseFloat(e.target.value) })}
                      className="w-full px-3 py-2 border border-themeBorder rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2">High Estimate ($)</label>
                    <input
                      type="number"
                      value={estimateEditData.highEstimate}
                      onChange={(e) => setEstimateEditData({ ...estimateEditData, highEstimate: parseFloat(e.target.value) })}
                      className="w-full px-3 py-2 border border-themeBorder rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2">Deposit Amount ($)</label>
                    <input
                      type="number"
                      placeholder="0"
                      value={estimateEditData.depositAmount}
                      onChange={(e) => setEstimateEditData({ ...estimateEditData, depositAmount: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-themeBorder rounded-lg"
                    />
                    <p className="text-xs text-themeMuted mt-1">Leave empty or 0 for no deposit required</p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">Time Estimation</label>
                  <input
                    type="text"
                    placeholder="e.g., '3-5 days', '1-2 weeks'"
                    value={estimateEditData.timeEstimation}
                    onChange={(e) => setEstimateEditData({ ...estimateEditData, timeEstimation: e.target.value })}
                    className="w-full px-3 py-2 border border-themeBorder rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">Material List</label>
                  <div className="space-y-2">
                    {estimateEditData.materialList.map((m, i) => (
                      <div key={i} className="flex flex-wrap sm:flex-nowrap gap-2 items-start border border-themeBorder rounded-lg p-2">
                        <input
                          type="text"
                          placeholder="Item"
                          value={m.item}
                          onChange={(e) => updateMaterialRow(i, 'item', e.target.value)}
                          className="flex-1 min-w-[8rem] px-2 py-1 border border-themeBorder rounded"
                        />
                        <input
                          type="number"
                          placeholder="Qty"
                          value={m.quantity}
                          onChange={(e) => updateMaterialRow(i, 'quantity', e.target.value)}
                          className="w-20 px-2 py-1 border border-themeBorder rounded"
                        />
                        <input
                          type="text"
                          placeholder="Unit"
                          value={m.unit}
                          onChange={(e) => updateMaterialRow(i, 'unit', e.target.value)}
                          className="w-24 px-2 py-1 border border-themeBorder rounded"
                        />
                        <input
                          type="number"
                          placeholder="Price/unit"
                          value={m.estimatedPrice}
                          onChange={(e) => updateMaterialRow(i, 'estimatedPrice', e.target.value)}
                          className="w-28 px-2 py-1 border border-themeBorder rounded"
                        />
                        <button
                          onClick={() => removeMaterialRow(i)}
                          className="px-2 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={addMaterialRow}
                    className="mt-2 px-3 py-1 bg-gray-200 text-themeMuted rounded text-sm hover:bg-gray-300 font-semibold"
                  >
                    + Add material
                  </button>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">Material Notes</label>
                  <textarea
                    placeholder="Any other freeform material notes"
                    value={estimateEditData.materialRequirements}
                    onChange={(e) => setEstimateEditData({ ...estimateEditData, materialRequirements: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-themeBorder rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">Breakdown</label>
                  <textarea
                    value={estimateEditData.breakdown}
                    onChange={(e) => setEstimateEditData({ ...estimateEditData, breakdown: e.target.value })}
                    rows={4}
                    className="w-full px-3 py-2 border border-themeBorder rounded-lg"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleSaveEstimate}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold"
                  >
                    Save Changes
                  </button>
                  <button
                    onClick={() => setIsEditingEstimate(false)}
                    className="flex-1 px-4 py-2 bg-gray-400 text-white rounded-lg hover:bg-themeBg0 font-semibold"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {quote.estimate && !isEditingEstimate && (
            <div>
              {(() => {
                const tier = quote.estimate?.selectedTier || 'expected';
                const tierAmount =
                  tier === 'low'
                    ? quote.estimate!.lowEstimate
                    : tier === 'high'
                    ? quote.estimate!.highEstimate
                    : quote.estimate!.expectedEstimate;
                const tierColor = tier === 'low' ? 'text-accent' : tier === 'high' ? 'text-red-600' : 'text-green-600';
                const tierBg = tier === 'low' ? 'bg-blue-50' : tier === 'high' ? 'bg-red-50' : 'bg-green-50';
                return (
                  <div className={`p-6 rounded-lg mb-4 ${tierBg}`}>
                    <p className="text-sm text-themeMuted mb-1">
                      Quoted Price <span className="capitalize">({tier})</span>
                    </p>
                    <p className={`text-4xl font-bold ${tierColor}`}>${tierAmount.toLocaleString()}</p>
                    <div className="flex flex-wrap gap-2 mt-4">
                      {(['low', 'expected', 'high'] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => handleSelectTier(t)}
                          disabled={savingTier}
                          className={`px-3 py-1 rounded text-sm font-medium capitalize disabled:opacity-50 ${
                            tier === t
                              ? 'bg-brand text-white'
                              : 'bg-white text-themeMuted border border-themeBorder hover:border-brand'
                          }`}
                        >
                          {t === 'low'
                            ? `Low ($${quote.estimate!.lowEstimate.toLocaleString()})`
                            : t === 'high'
                            ? `High ($${quote.estimate!.highEstimate.toLocaleString()})`
                            : `Expected ($${quote.estimate!.expectedEstimate.toLocaleString()})`}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {quote.estimate.materialList && quote.estimate.materialList.length > 0 && (
                <div className="bg-purple-50 p-4 rounded-lg mb-4 overflow-x-auto">
                  <p className="text-sm font-semibold text-themeMuted mb-2">Estimated Materials</p>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-themeMuted">
                        <th className="pr-2 pb-1">Item</th>
                        <th className="pr-2 pb-1 text-right">Qty</th>
                        <th className="pr-2 pb-1 text-right">Price/unit</th>
                        <th className="pb-1 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {quote.estimate.materialList.map((m, i) => (
                        <tr key={i} className="border-t border-purple-200">
                          <td className="py-1 pr-2 break-words">{m.item}</td>
                          <td className="py-1 pr-2 text-right whitespace-nowrap">{m.quantity} {m.unit}</td>
                          <td className="py-1 pr-2 text-right whitespace-nowrap">${m.estimatedPrice.toFixed(2)}</td>
                          <td className="py-1 text-right whitespace-nowrap">${(m.quantity * m.estimatedPrice).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {quote.estimate.timeEstimation && (
                <div className="bg-blue-50 p-4 rounded-lg mb-4">
                  <p className="text-sm font-semibold text-themeMuted mb-1">Timeline</p>
                  <p className="text-themeMuted">{quote.estimate.timeEstimation}</p>
                </div>
              )}

              {quote.estimate.depositAmount && quote.estimate.depositAmount > 0 && (
                <div className="bg-orange-50 p-4 rounded-lg mb-4 border-2 border-orange-200">
                  <p className="text-sm font-semibold text-orange-700 mb-1">💳 Deposit Required</p>
                  <p className="text-2xl font-bold text-orange-700">${(quote.estimate.depositAmount / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  <p className="text-xs text-orange-600 mt-2">Customer will receive a payment link after approving the quote</p>
                </div>
              )}

              {quote.estimate.materialRequirements && (
                <div className="bg-purple-50 p-4 rounded-lg mb-4">
                  <p className="text-sm font-semibold text-themeMuted mb-1">Materials Required</p>
                  <p className="text-themeMuted whitespace-pre-wrap text-sm">{quote.estimate.materialRequirements}</p>
                </div>
              )}

              <div className="bg-themeBg p-4 rounded-lg mb-6">
                <p className="text-sm font-semibold text-themeMuted mb-2">Breakdown</p>
                <p className="text-themeMuted whitespace-pre-wrap text-sm">{quote.estimate.breakdown}</p>
              </div>

              {quote.status !== 'sent' && (
                <button
                  onClick={handleSendEstimate}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold"
                >
                  Send Estimate to Customer
                </button>
              )}

              {quote.status === 'sent' && (
                <div className="bg-green-50 p-4 rounded-lg border border-green-200 text-green-700 text-center font-semibold">
                  ✅ Estimate sent to customer
                </div>
              )}
            </div>
          )}

          {!quote.estimate && (
            <p className="text-themeMuted">No analysis yet. Click "Analyze" to generate an estimate.</p>
          )}
        </div>

        {/* Conversation */}
        <div className="bg-white rounded-lg shadow-md p-4 sm:p-8 mb-6">
          <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
            <h2 className="text-xl font-bold">Conversation</h2>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={fetchEmails}
                disabled={emailsLoading}
                className="px-3 py-2 bg-gray-200 text-themeMuted rounded-lg hover:bg-gray-300 disabled:opacity-50 text-sm font-semibold"
              >
                {emailsLoading ? 'Loading...' : 'Refresh'}
              </button>
              {emails.length > 0 && (
                <button
                  onClick={handleAnalyzeEmails}
                  disabled={analyzingEmails}
                  className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 text-sm font-semibold"
                >
                  {analyzingEmails ? 'Analyzing...' : 'Analyze emails'}
                </button>
              )}
            </div>
          </div>

          {!emailsConfigured && (
            <p className="text-themeMuted text-sm">
              Email integration isn&apos;t configured yet. Add the Gmail OAuth environment variables to enable the conversation view.
            </p>
          )}

          {emailsConfigured && emailError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {emailError}
            </div>
          )}

          {emailsConfigured && !emailsLoading && emails.length === 0 && !emailError && (
            <p className="text-themeMuted text-sm">
              No emails found for this quote yet. Customer replies will appear here once they respond.
            </p>
          )}

          {emailAnalysis && (
            <div className="mb-6 p-5 bg-purple-50 border-2 border-purple-200 rounded-lg">
              <h3 className="font-bold text-purple-900 mb-2">AI Summary</h3>
              <p className="text-sm text-themeMuted mb-3">{emailAnalysis.summary}</p>
              {emailAnalysis.requestedChanges?.length > 0 && (
                <div className="mb-3">
                  <p className="text-sm font-semibold text-themeMuted">Customer is asking for:</p>
                  <ul className="list-disc list-inside text-sm text-themeMuted">
                    {emailAnalysis.requestedChanges.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}
              {emailAnalysis.newDetails?.length > 0 && (
                <div className="mb-3">
                  <p className="text-sm font-semibold text-themeMuted">New details:</p>
                  <ul className="list-disc list-inside text-sm text-themeMuted">
                    {emailAnalysis.newDetails.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}
              {emailAnalysis.suggestedEstimate ? (
                <div className="mt-3 p-3 bg-white rounded border border-purple-200">
                  <p className="text-sm font-semibold text-themeMuted mb-1">Suggested estimate</p>
                  <p className="text-sm text-themeMuted">
                    Low ${emailAnalysis.suggestedEstimate.low.toLocaleString()} · Expected ${emailAnalysis.suggestedEstimate.expected.toLocaleString()} · High ${emailAnalysis.suggestedEstimate.high.toLocaleString()}
                  </p>
                  <p className="text-xs text-themeMuted mt-1">{emailAnalysis.reasoning}</p>
                  <button
                    onClick={applySuggestedEstimate}
                    className="mt-2 px-3 py-1 bg-brand text-white rounded text-sm hover:bg-brandDark font-semibold"
                  >
                    Review &amp; apply to estimate
                  </button>
                </div>
              ) : (
                emailAnalysis.reasoning && (
                  <p className="text-sm text-themeMuted mt-2">
                    No pricing change suggested. {emailAnalysis.reasoning}
                  </p>
                )
              )}
            </div>
          )}

          {emails.length > 0 && (
            <div className="space-y-3 mb-6">
              {emails.map((m) => (
                <div key={m.id} className="border border-themeBorder rounded-lg p-4 min-w-0 overflow-hidden">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-baseline gap-0.5 mb-1">
                    <p className="text-sm font-semibold text-themeText break-words min-w-0">{m.from}</p>
                    <p className="text-xs text-themeMuted sm:ml-2 whitespace-nowrap">{m.date}</p>
                  </div>
                  <p className="text-xs text-themeMuted mb-2 break-words">{m.subject}</p>
                  <p className="text-sm text-themeMuted whitespace-pre-wrap break-words">{m.body || m.snippet}</p>
                </div>
              ))}
            </div>
          )}

          {emailsConfigured && emails.length > 0 && (
            <div className="border-t pt-4">
              <label className="block text-sm font-semibold mb-2">Reply to customer</label>
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                rows={4}
                placeholder="Type your reply..."
                className="w-full px-4 py-2 border border-themeBorder rounded-lg mb-2"
              />
              <button
                onClick={handleSendReply}
                disabled={sendingReply || !replyText.trim()}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-semibold"
              >
                {sendingReply ? 'Sending...' : 'Send Reply'}
              </button>
            </div>
          )}
        </div>

        {/* Create Invoice */}
        <div className="bg-white rounded-lg shadow-md p-4 sm:p-8 mb-6">
          <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
            <h2 className="text-xl font-bold">
              Invoice {invoice && <span className="text-sm text-themeMuted font-normal">#{invoice.invoiceNumber} ({invoice.status})</span>}
            </h2>
            {!showInvoiceEditor && (
              <button
                onClick={invoice ? handleOpenInvoiceEditor : handleCreateInvoice}
                disabled={invoiceLoading || savingInvoice}
                className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent disabled:opacity-50 font-semibold"
              >
                {savingInvoice ? 'Creating…' : invoice ? 'Edit Invoice' : 'Create Invoice'}
              </button>
            )}
          </div>

          {invoiceError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {invoiceError}
            </div>
          )}

          {invoiceSentMsg && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded text-green-700 text-sm">
              {invoiceSentMsg}
            </div>
          )}

          {showInvoiceEditor && (
            <div className="space-y-3">
              <div className="space-y-2">
                {invoiceLineItems.map((li, i) => (
                  <div key={i} className="flex flex-wrap sm:flex-nowrap gap-2 items-start border border-themeBorder rounded-lg p-2">
                    <input
                      type="text"
                      placeholder="Description"
                      value={li.description}
                      onChange={(e) => updateInvoiceRow(i, 'description', e.target.value)}
                      className="flex-1 min-w-[10rem] px-2 py-1 border border-themeBorder rounded"
                    />
                    <input
                      type="number"
                      placeholder="Qty"
                      value={li.quantity}
                      onChange={(e) => updateInvoiceRow(i, 'quantity', e.target.value)}
                      className="w-20 px-2 py-1 border border-themeBorder rounded"
                    />
                    <input
                      type="number"
                      placeholder="Unit Price"
                      value={li.unitPrice}
                      onChange={(e) => updateInvoiceRow(i, 'unitPrice', e.target.value)}
                      className="w-28 px-2 py-1 border border-themeBorder rounded"
                    />
                    <p className="w-24 px-2 py-1 text-sm text-themeMuted text-right">
                      ${(li.quantity * li.unitPrice).toFixed(2)}
                    </p>
                    <button
                      onClick={() => removeInvoiceRow(i)}
                      className="px-2 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>

              <button
                onClick={addInvoiceRow}
                className="px-3 py-1 bg-gray-200 text-themeMuted rounded text-sm hover:bg-gray-300 font-semibold"
              >
                + Add line item
              </button>

              <div>
                <label className="block text-sm font-semibold mb-2">Notes (optional)</label>
                <textarea
                  value={invoiceNotes}
                  onChange={(e) => setInvoiceNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-themeBorder rounded-lg"
                />
              </div>

              <div className="flex justify-end text-lg font-bold">
                Total: ${invoiceTotal.toFixed(2)}
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleSaveAndPreviewInvoice}
                  disabled={savingInvoice || invoiceLineItems.length === 0}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-semibold"
                >
                  {savingInvoice ? 'Saving…' : 'Save & Preview PDF'}
                </button>
                <button
                  onClick={() => setShowInvoiceEditor(false)}
                  className="px-4 py-2 bg-gray-300 text-themeMuted rounded-lg hover:bg-gray-400 font-semibold"
                >
                  Close
                </button>
              </div>
            </div>
          )}

          {!showInvoiceEditor && invoice && (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-themeMuted text-sm">
                Total: <span className="font-semibold">${invoice.total.toLocaleString()}</span>
                {invoice.sentAt ? ` · Sent ${new Date(invoice.sentAt).toLocaleDateString()}` : ''}
              </p>
              <button
                onClick={() => setPdfPreviewUrl(`/api/admin/quotes/${quoteId}/invoice/pdf?t=${Date.now()}`)}
                className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent font-semibold text-sm"
              >
                View PDF
              </button>
              <button
                onClick={handleEmailInvoice}
                disabled={sendingInvoice}
                className="px-4 py-2 bg-brand text-white rounded-lg hover:bg-brandDark disabled:opacity-50 font-semibold text-sm"
              >
                {sendingInvoice ? 'Sending…' : 'Email PDF to Customer'}
              </button>
            </div>
          )}

          {!showInvoiceEditor && !invoice && !invoiceLoading && (
            <p className="text-themeMuted text-sm">No invoice yet. Click "Create Invoice" to build one from the estimate.</p>
          )}

          {pdfPreviewUrl && (
            <div className="mt-4 border border-themeBorder rounded-lg overflow-hidden">
              <div className="flex justify-between items-center px-3 py-2 bg-gray-50 border-b border-themeBorder">
                <p className="text-sm font-semibold text-themeMuted">Invoice PDF Preview</p>
                <button
                  onClick={() => setPdfPreviewUrl('')}
                  className="text-sm text-themeMuted hover:text-brand font-semibold"
                >
                  Close Preview
                </button>
              </div>
              <iframe
                src={pdfPreviewUrl}
                title="Invoice PDF Preview"
                className="w-full"
                style={{ height: '70vh', border: 'none' }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

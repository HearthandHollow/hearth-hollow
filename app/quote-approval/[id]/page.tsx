'use client';

import Link from 'next/link';

interface PageProps {
  params: { id: string };
  searchParams: Record<string, string>;
}

export default function QuoteApprovalPage({ params, searchParams }: PageProps) {
  const isApproved = searchParams.approved === 'true';

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-blue-50 flex flex-col items-center justify-center px-4">
      <div className="max-w-md bg-white rounded-lg shadow-lg p-8 text-center">
        {isApproved ? (
          <>
            <div className="text-6xl mb-4">✅</div>
            <h1 className="text-3xl font-bold mb-2 text-themeText">Quote Approved!</h1>
            <p className="text-themeMuted mb-6">
              Thank you for approving the estimate. We'll get started on your project right away and keep you updated on our progress.
            </p>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-themeMuted">Reference Number:</p>
              <p className="text-lg font-mono font-bold text-green-600 break-all">{params.id}</p>
            </div>
            <div className="bg-blue-50 border border-accent rounded-lg p-4 mb-6">
              <p className="text-sm text-blue-800">
                <strong>Next steps:</strong>
                <br />
                1. We'll confirm the start date with you
                <br />
                2. Our team will arrive at the scheduled time
                <br />
                3. You'll receive updates throughout the project
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="text-6xl mb-4">😢</div>
            <h1 className="text-3xl font-bold mb-2 text-themeText">Quote Declined</h1>
            <p className="text-themeMuted mb-6">
              We understand. If you have any questions about the estimate or would like to discuss modifications, please feel free to reach out to us.
            </p>
            <div className="bg-themeBg border border-themeBorder rounded-lg p-4 mb-6">
              <p className="text-sm text-themeMuted">Reference Number:</p>
              <p className="text-lg font-mono font-bold text-themeMuted break-all">{params.id}</p>
            </div>
          </>
        )}

        <p className="text-sm text-themeMuted mb-6">
          Check your email for further communication. Thank you for considering Hearth & Hollow!
        </p>

        <Link
          href="/"
          className="inline-block px-6 py-2 bg-accent text-white rounded-lg hover:bg-accent transition"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}

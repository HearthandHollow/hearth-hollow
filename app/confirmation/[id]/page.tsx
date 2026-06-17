"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function ConfirmationPage({ params }: { params: { id: string } }) {
  const [referenceId] = useState(params.id);

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-blue-50 flex flex-col items-center justify-center px-4">
      <div className="max-w-md bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="text-6xl mb-4">✅</div>
        <h1 className="text-3xl font-bold mb-2 text-themeText">Quote Request Received!</h1>
        <p className="text-themeMuted mb-6">
          Thank you for submitting your project. We'll review your photos and details, then send you a professional estimate within 24 hours.
        </p>

        <div className="bg-blue-50 border border-accent rounded-lg p-4 mb-6">
          <p className="text-sm text-themeMuted">Your Reference Number:</p>
          <p className="text-lg font-mono font-bold text-accent break-all">{referenceId}</p>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-yellow-800">
            <strong>What happens next:</strong>
            <br />
            1. We analyze your project and photos
            <br />
            2. AI generates an estimate
            <br />
            3. We review for accuracy
            <br />
            4. You receive a professional quote
          </p>
        </div>

        <p className="text-sm text-themeMuted mb-6">
          Check your email for updates. We'll reach out if we need any clarification.
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

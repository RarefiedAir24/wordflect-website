import React from "react";
import Link from "next/link";

const Terms = () => (
  <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg text-gray-900 my-12">
    <h1 className="text-3xl font-bold mb-4">Terms of Service</h1>
    <p className="mb-4">Last updated: July 2024</p>
    <h2 className="text-xl font-semibold mt-6 mb-2">1. Acceptance of Terms</h2>
    <p className="mb-4">By accessing or using Wordflect (the &quot;Service&quot;), you agree to be bound by these Terms of Service and all applicable laws and regulations. If you do not agree, please do not use the Service.</p>
    <h2 className="text-xl font-semibold mt-6 mb-2">2. Use of the Service</h2>
    <p className="mb-4">You may use the Service only for lawful purposes and in accordance with these Terms. You agree not to misuse the Service or interfere with its normal operation.</p>
    <h2 className="text-xl font-semibold mt-6 mb-2">3. Accounts</h2>
    <p className="mb-4">To access certain features, you may need to create an account. You are responsible for maintaining the confidentiality of your account and password and for all activities that occur under your account.</p>
    <h2 className="text-xl font-semibold mt-6 mb-2">4. Intellectual Property</h2>
    <p className="mb-4">All content, features, and functionality of the Service are the exclusive property of Wordflect and its licensors. You may not copy, modify, distribute, or create derivative works without our written permission.</p>
    <h2 className="text-xl font-semibold mt-6 mb-2">5. Disclaimers</h2>
    <p className="mb-4">The Service is provided on an &quot;AS IS&quot; and &quot;AS AVAILABLE&quot; basis. We make no warranties, express or implied, regarding the Service&apos;s accuracy, reliability, or availability.</p>
    <h2 className="text-xl font-semibold mt-6 mb-2">6. Limitation of Liability</h2>
    <p className="mb-4">To the fullest extent permitted by law, Wordflect and its affiliates shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the Service.</p>
    <h2 className="text-xl font-semibold mt-6 mb-2">7. Governing Law</h2>
    <p className="mb-4">These Terms are governed by the laws of your jurisdiction, without regard to its conflict of law provisions.</p>
    <h2 className="text-xl font-semibold mt-6 mb-2">8. Changes to Terms</h2>
    <p className="mb-4">We may update these Terms from time to time. We will notify you of significant changes by posting the new Terms on this page. Your continued use of the Service after changes means you accept the new Terms.</p>
    <h2 className="text-xl font-semibold mt-6 mb-2">9. Contact Us</h2>
    <p className="mb-4">If you have any questions about these Terms, please contact us at <a href="mailto:support@wordflect.com" className="text-blue-600 underline">support@wordflect.com</a>.</p>
    <div className="text-center mt-12">
      <Link 
        href="/"
        className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-gray-700 to-gray-800 text-white font-bold rounded-lg hover:scale-105 transition-all duration-150 border border-gray-600"
      >
        <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
          <path stroke="currentColor" strokeWidth="2" d="m15 18-6-6 6-6"/>
        </svg>
        Back to Home
      </Link>
    </div>
  </div>
);

export default Terms; 
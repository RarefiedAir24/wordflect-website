import React from "react";
import Link from "next/link";

const PrivacyPolicy = () => (
  <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg text-gray-900">
    <h1 className="text-3xl font-bold mb-4">Privacy Policy</h1>
    <p className="mb-4">Last updated: July 2025</p>
    <p className="mb-4">
      This Privacy Policy describes how Wordflect (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) collects, uses, and shares your information when you use our website and mobile app (the &quot;Service&quot;).
    </p>
    <h2 className="text-xl font-semibold mt-6 mb-2">1. Information We Collect</h2>
    <ul className="list-disc list-inside mb-4">
      <li><b>Account Information:</b> When you sign up, we collect your email, username, and password (encrypted).</li>
      <li><b>Usage Data:</b> We collect information about how you use the Service, including game progress, achievements, and device information.</li>
      <li><b>In-App Purchases:</b> If you make purchases, we collect transaction data (but not your full payment details, which are handled securely by the App Store).</li>
      <li><b>Cookies &amp; Analytics:</b> We use cookies and analytics tools to improve the Service.</li>
    </ul>
    <h2 className="text-xl font-semibold mt-6 mb-2">2. How We Use Your Information</h2>
    <ul className="list-disc list-inside mb-4">
      <li>To provide and improve the Service</li>
      <li>To personalize your experience</li>
      <li>To process in-app purchases and manage your account</li>
      <li>To communicate with you about updates, support, and offers</li>
      <li>To comply with legal obligations</li>
    </ul>
    <h2 className="text-xl font-semibold mt-6 mb-2">3. Sharing Your Information</h2>
    <ul className="list-disc list-inside mb-4">
      <li>We do <b>not</b> sell your personal information.</li>
      <li>We may share data with service providers (e.g., analytics, cloud hosting) as needed to operate the Service.</li>
      <li>We may disclose information if required by law or to protect our rights.</li>
    </ul>
    <h2 className="text-xl font-semibold mt-6 mb-2">4. In-App Purchases</h2>
    <p className="mb-4">
      All in-app purchases are processed securely through the Apple App Store. We do not store your payment card details. Please review Apple&apos;s privacy and payment policies for more information.
    </p>
    <h2 className="text-xl font-semibold mt-6 mb-2">5. Data Security</h2>
    <p className="mb-4">
      We use industry-standard security measures to protect your data. However, no method of transmission or storage is 100% secure.
    </p>
    <h2 className="text-xl font-semibold mt-6 mb-2">6. Children&apos;s Privacy</h2>
    <p className="mb-4">
      The Service is not intended for children under 13. We do not knowingly collect personal information from children under 13.
    </p>
    <h2 className="text-xl font-semibold mt-6 mb-2">7. Your Rights &amp; Choices</h2>
    <ul className="list-disc list-inside mb-4">
      <li>You may access, update, or delete your account information at any time.</li>
      <li>You may opt out of marketing emails by following the unsubscribe link.</li>
      <li>Contact us at <a href="mailto:support@wordflect.com" className="text-blue-600 underline">support@wordflect.com</a> for privacy questions.</li>
    </ul>
    <h2 className="text-xl font-semibold mt-6 mb-2">8. Changes to This Policy</h2>
    <p className="mb-4">
      We may update this Privacy Policy from time to time. We will notify you of significant changes by posting the new policy on this page.
    </p>
    <h2 className="text-xl font-semibold mt-6 mb-2">9. Contact Us</h2>
    <p>
      If you have any questions about this Privacy Policy, please contact us at <a href="mailto:support@wordflect.com" className="text-blue-600 underline">support@wordflect.com</a>.
    </p>
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

export default PrivacyPolicy; 
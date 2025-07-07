"use client";
import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";

export default function Support() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<"idle" | "success" | "error">("idle");

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      // Send email to support@wordflect.com
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          subject: formData.subject,
          message: formData.message,
          to: 'support@wordflect.com'
        }),
      });

      if (response.ok) {
        setSubmitStatus("success");
        // Reset form after 3 seconds
        setTimeout(() => {
          setSubmitStatus("idle");
          setFormData({ name: "", email: "", subject: "", message: "" });
        }, 3000);
      } else {
        setSubmitStatus("error");
        setTimeout(() => setSubmitStatus("idle"), 3000);
      }
    } catch (error) {
      console.error('Contact form error:', error);
      setSubmitStatus("error");
      setTimeout(() => setSubmitStatus("idle"), 3000);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-black">
      {/* Navigation Bar */}
      <nav className="relative z-10 flex justify-between items-center p-6 bg-black bg-opacity-20 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <Link href="/">
            <Image src="/apple-touch-icon.png" alt="Wordflect Logo" width={40} height={40} className="rounded-lg" />
          </Link>
          <span className="text-2xl font-bold text-white tracking-wide hidden sm:inline">Wordflect</span>
        </div>
        <div className="flex gap-8 text-white font-medium text-lg">
          <Link href="/" className="hover:text-blue-300 transition">Home</Link>
          <Link href="/faq" className="hover:text-blue-300 transition">FAQ</Link>
          <Link href="/tips" className="hover:text-blue-300 transition">Tips</Link>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto py-16 px-4">
        <div className="text-center mb-12">
          <h1 className="text-5xl sm:text-6xl font-extrabold text-white mb-4 animate-text-glow">
            Support
          </h1>
          <p className="text-xl text-blue-100 max-w-2xl mx-auto">
            Need help? We&apos;re here to assist you with any questions about Wordflect.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Contact Form */}
          <div className="bg-black/40 backdrop-blur-sm rounded-2xl p-8 shadow-2xl border border-white/10">
            <h2 className="text-2xl font-bold text-white mb-6">Send us a message</h2>
            
            {submitStatus === "success" && (
              <div className="mb-6 bg-green-600/90 text-white font-semibold rounded-lg px-4 py-3 text-center animate-fade-in">
                Message sent successfully! We&apos;ll get back to you soon.
              </div>
            )}
            
            {submitStatus === "error" && (
              <div className="mb-6 bg-red-600/90 text-white font-semibold rounded-lg px-4 py-3 text-center animate-fade-in">
                Failed to send message. Please try again or email us directly at support@wordflect.com
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="name" className="block text-blue-200 font-semibold mb-2">Name</label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 rounded-lg border border-blue-400 bg-white/10 text-white placeholder-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                    placeholder="Your name"
                    required
                    disabled={isSubmitting}
                  />
                </div>
                <div>
                  <label htmlFor="email" className="block text-blue-200 font-semibold mb-2">Email</label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 rounded-lg border border-blue-400 bg-white/10 text-white placeholder-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                    placeholder="your@email.com"
                    required
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="subject" className="block text-blue-200 font-semibold mb-2">Subject</label>
                <select
                  id="subject"
                  name="subject"
                  value={formData.subject}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 rounded-lg border border-blue-400 bg-white text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                  required
                  disabled={isSubmitting}
                >
                  <option value="">Select a topic</option>
                  <option value="technical">Technical Support</option>
                  <option value="billing">Billing & Payments</option>
                  <option value="feature">Feature Request</option>
                  <option value="bug">Bug Report</option>
                  <option value="general">General Inquiry</option>
                </select>
              </div>

              <div>
                <label htmlFor="message" className="block text-blue-200 font-semibold mb-2">Message</label>
                <textarea
                  id="message"
                  name="message"
                  value={formData.message}
                  onChange={handleInputChange}
                  rows={6}
                  className="w-full px-4 py-3 rounded-lg border border-blue-400 bg-white/10 text-white placeholder-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition resize-none"
                  placeholder="Tell us how we can help..."
                  required
                  disabled={isSubmitting}
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className={`w-full py-4 rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 text-white font-bold text-lg shadow-lg transition-all duration-150 ${
                  isSubmitting ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'
                }`}
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></span>
                    Sending...
                  </span>
                ) : (
                  "Send Message"
                )}
              </button>
            </form>
          </div>

          {/* Contact Information */}
          <div className="space-y-6">
            {/* Direct Email */}
            <div className="bg-black/40 backdrop-blur-sm rounded-2xl p-8 shadow-2xl border border-white/10">
              <h3 className="text-xl font-bold text-white mb-4">Direct Contact</h3>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                    <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
                      <path stroke="currentColor" strokeWidth="2" d="M3 7.5V17a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7.5m-18 0A2 2 0 0 1 5 5.5h14a2 2 0 0 1 2 2m-18 0 10 7 10-7"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-blue-200 text-sm">Email us directly</p>
                    <a 
                      href="mailto:support@wordflect.com" 
                      className="text-white font-semibold hover:text-blue-300 transition"
                    >
                      support@wordflect.com
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* FAQ Link */}
            <div className="bg-black/40 backdrop-blur-sm rounded-2xl p-8 shadow-2xl border border-white/10">
              <h3 className="text-xl font-bold text-white mb-4">Quick Help</h3>
              <p className="text-blue-200 mb-4">
                Check our FAQ for answers to common questions about gameplay, features, and troubleshooting.
              </p>
              <Link 
                href="/faq"
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-blue-500 text-white font-bold rounded-lg hover:scale-105 transition-all duration-150"
              >
                View FAQ
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
                  <path stroke="currentColor" strokeWidth="2" d="m9 18 6-6-6-6"/>
                </svg>
              </Link>
            </div>

            {/* Response Time */}
            <div className="bg-black/40 backdrop-blur-sm rounded-2xl p-8 shadow-2xl border border-white/10">
              <h3 className="text-xl font-bold text-white mb-4">Response Time</h3>
              <div className="space-y-2 text-blue-200">
                <p>• <span className="text-white font-semibold">Technical issues:</span> Within 24 hours</p>
                <p>• <span className="text-white font-semibold">General inquiries:</span> Within 48 hours</p>
                <p>• <span className="text-white font-semibold">Feature requests:</span> We&apos;ll review and respond</p>
              </div>
            </div>
          </div>
        </div>

        {/* Back to Home */}
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
    </div>
  );
} 
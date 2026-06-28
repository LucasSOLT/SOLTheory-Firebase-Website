export const metadata = {
  title: "Data Deletion | SOLTheory",
  description: "How to request deletion of your personal data from SOLTheory, including Instagram and social media integrations.",
};

export default function DataDeletionPage() {
  return (
    <div className="min-h-screen bg-white px-8 py-16 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold text-slate-900 mb-2">Data Deletion Instructions</h1>
      <p className="text-sm text-slate-500 mb-8">Last updated: June 27, 2026</p>

      <div className="prose prose-slate text-sm space-y-4 text-slate-700 leading-relaxed">
        <p>MyTaj LLC d/b/a SOLTheory (&quot;SOLTheory,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) respects your right to control your personal data. This page explains how to request deletion of data we store on your behalf.</p>

        <h2 className="text-lg font-semibold text-slate-800 mt-8">1. What Data We Store</h2>
        <p>When you connect your Instagram or Facebook account to SOLTheory, we may store the following information:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li><strong>OAuth Access Tokens</strong> — encrypted with AES-256-GCM and used solely to publish content on your behalf</li>
          <li><strong>Instagram Business Account ID</strong> and <strong>username</strong></li>
          <li><strong>Facebook Page ID</strong></li>
          <li><strong>Scheduled post data</strong> — including captions, media URLs, scheduling timestamps, and publication status</li>
          <li><strong>Profile picture URL</strong> — cached for display purposes</li>
        </ul>
        <p>We do <strong>not</strong> store your Facebook or Instagram password. We do <strong>not</strong> access your private messages, followers list, or personal photos beyond what you explicitly upload to our platform.</p>

        <h2 className="text-lg font-semibold text-slate-800 mt-8">2. How to Request Data Deletion</h2>
        <p>You can request deletion of your data in any of the following ways:</p>

        <h3 className="text-base font-semibold text-slate-800 mt-4">Option A: Self-Service (Recommended)</h3>
        <ol className="list-decimal pl-6 space-y-1">
          <li>Log in to your SOLTheory dashboard at <strong>soltheory.com</strong></li>
          <li>Navigate to <strong>Agentic Campaigning → Instagram</strong></li>
          <li>Click <strong>Disconnect Account</strong> in your account settings</li>
          <li>This immediately deletes all stored tokens and connection data from our servers</li>
        </ol>

        <h3 className="text-base font-semibold text-slate-800 mt-4">Option B: Email Request</h3>
        <p>Send an email to <a href="mailto:team@soltheory.com" className="text-pink-600 underline">team@soltheory.com</a> with the subject line <strong>&quot;Data Deletion Request&quot;</strong> and include:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Your full name</li>
          <li>The email address associated with your SOLTheory account</li>
          <li>Your Instagram username (if applicable)</li>
          <li>A description of the data you want deleted</li>
        </ul>
        <p>We will process your request within <strong>30 days</strong> and send a confirmation email once deletion is complete.</p>

        <h3 className="text-base font-semibold text-slate-800 mt-4">Option C: Facebook App Settings</h3>
        <p>You can also revoke SOLTheory&apos;s access directly from Facebook:</p>
        <ol className="list-decimal pl-6 space-y-1">
          <li>Go to <a href="https://www.facebook.com/settings?tab=business_tools" target="_blank" rel="noopener noreferrer" className="text-pink-600 underline">Facebook Settings → Business Integrations</a></li>
          <li>Find <strong>SOL Theory</strong> in the list</li>
          <li>Click <strong>Remove</strong></li>
          <li>This revokes our access to your Facebook and Instagram accounts</li>
        </ol>
        <p>When you revoke access through Facebook, we receive a deauthorization callback and automatically delete your stored tokens within 24 hours.</p>

        <h2 className="text-lg font-semibold text-slate-800 mt-8">3. What Gets Deleted</h2>
        <p>Upon a valid deletion request, we will permanently remove:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>All encrypted OAuth tokens (Instagram and Facebook)</li>
          <li>Your Instagram connection record and account metadata</li>
          <li>All scheduled, draft, and failed post records associated with your account</li>
          <li>Any cached profile information (username, profile picture URL)</li>
        </ul>

        <h2 className="text-lg font-semibold text-slate-800 mt-8">4. What We Retain</h2>
        <p>We may retain the following for legal and operational purposes:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li><strong>Server logs</strong> — anonymized API request logs (retained for up to 90 days for security and debugging)</li>
          <li><strong>Billing records</strong> — as required by applicable tax and financial regulations</li>
        </ul>
        <p>Retained data does not include your social media credentials or personal content.</p>

        <h2 className="text-lg font-semibold text-slate-800 mt-8">5. Contact Us</h2>
        <p>If you have any questions about data deletion or your privacy rights, please contact us:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li><strong>Email:</strong> <a href="mailto:team@soltheory.com" className="text-pink-600 underline">team@soltheory.com</a></li>
          <li><strong>Website:</strong> <a href="https://soltheory.com" className="text-pink-600 underline">soltheory.com</a></li>
        </ul>

        <hr className="my-8 border-slate-200" />
        <p className="text-xs text-slate-400">SOLTheory is operated by MyTaj LLC. This data deletion policy is provided in compliance with Meta Platform Terms and applicable data protection regulations.</p>
      </div>
    </div>
  );
}

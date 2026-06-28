export const metadata = {
  title: "Privacy Policy | SOLTheory",
  description: "SOLTheory privacy policy — how we collect, use, store, and protect your personal information.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white px-8 py-16 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold text-slate-900 mb-2">Privacy Policy</h1>
      <p className="text-sm text-slate-500 mb-8">Last updated: May 10, 2026</p>

      <div className="prose prose-slate text-sm space-y-4 text-slate-700 leading-relaxed">
        <p>MyTaj LLC d/b/a SOLTheory (&quot;SOLTheory,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our website at <strong>soltheory.com</strong> and related services (the &quot;Platform&quot;). By accessing or using the Platform, you agree to this Privacy Policy.</p>

        <h2 className="text-lg font-semibold text-slate-800 mt-8">1. Information We Collect</h2>
        <p><strong>Personal Information:</strong> When you create an account, we may collect your name, email address, phone number, business name, billing address, and payment information.</p>
        <p><strong>Authentication Data:</strong> When you connect third-party services (Google Workspace, QuickBooks Online, etc.), we store OAuth tokens and refresh tokens necessary to maintain your authorized connections.</p>
        <p><strong>Usage Data:</strong> We automatically collect information about how you interact with the Platform, including pages viewed, features used, timestamps, IP address, browser type, and device information.</p>
        <p><strong>Communications Data:</strong> If you use our SMS/text messaging features (powered by Twilio), we collect and store the content of messages sent and received, phone numbers, timestamps, and delivery status. This data is stored in your private account and is not shared with other users.</p>
        <p><strong>AI Interaction Data:</strong> Conversations with our AI assistant (&quot;Jarvis&quot;) may be stored to improve service quality and provide continuity across sessions.</p>

        <h2 className="text-lg font-semibold text-slate-800 mt-8">2. How We Use Your Information</h2>
        <p>We use the information we collect to:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Provide, operate, and maintain the Platform and its features</li>
          <li>Display relevant data from connected third-party services within your dashboard</li>
          <li>Send and receive SMS/text messages on your behalf via our messaging integration</li>
          <li>Process transactions and manage billing</li>
          <li>Respond to your inquiries and provide customer support</li>
          <li>Improve and personalize your experience on the Platform</li>
          <li>Comply with legal obligations</li>
        </ul>

        <h2 className="text-lg font-semibold text-slate-800 mt-8">3. SMS/Text Messaging</h2>
        <p>Our Platform includes an SMS messaging feature powered by Twilio. By activating this feature, you acknowledge and agree that:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>A dedicated phone number will be assigned to your account for sending and receiving text messages</li>
          <li>Message content, sender/recipient phone numbers, and metadata are stored securely in your private account</li>
          <li>Standard message and data rates from your mobile carrier may apply</li>
          <li>You may opt out of receiving messages at any time by replying <strong>STOP</strong> to any message</li>
          <li>You may request help by replying <strong>HELP</strong> to any message</li>
          <li>Message frequency varies based on your usage</li>
          <li>We do not sell or share your messaging data with third parties for marketing purposes</li>
        </ul>

        <h2 className="text-lg font-semibold text-slate-800 mt-8">4. SMS Compliance / Mobile Privacy</h2>
        <p>No mobile information will be shared with third parties/affiliates for marketing/promotional purposes. All the above categories exclude text messaging originator opt-in data and consent; this information will not be shared with any third parties.</p>

        <h2 className="text-lg font-semibold text-slate-800 mt-8">5. Data Storage and Security</h2>
        <p>All data is stored securely using Google Firebase and Cloud Firestore with industry-standard encryption at rest and in transit (TLS 1.2+). Authentication tokens are stored in your private user document and are not accessible to other users. We implement commercially reasonable security measures to protect your personal information, but no method of electronic storage is 100% secure.</p>

        <h2 className="text-lg font-semibold text-slate-800 mt-8">6. Third-Party Services</h2>
        <p>The Platform integrates with the following third-party services, each governed by their own privacy policies:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li><strong>Google Workspace</strong> (Gmail, Calendar, Drive) — for email and scheduling integration</li>
          <li><strong>Meta/Instagram</strong> (Instagram Graph API, Facebook Pages API) — for social media content publishing and campaign management</li>
          <li><strong>QuickBooks Online</strong> — for financial dashboard and invoicing</li>
          <li><strong>Twilio</strong> — for SMS/text messaging capabilities</li>
          <li><strong>Firebase/Google Cloud</strong> — for authentication, data storage, and hosting</li>
          <li><strong>Stripe</strong> — for payment processing (if applicable)</li>
        </ul>
        <p>We encourage you to review the privacy policies of these third-party services.</p>

        <h2 className="text-lg font-semibold text-slate-800 mt-8">7. Data Sharing and Disclosure</h2>
        <p>We do <strong>not</strong> sell, trade, rent, or share your personal information with third parties for their marketing purposes. We may disclose your information only in the following circumstances:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li><strong>Service Providers:</strong> To trusted third-party service providers who assist us in operating the Platform (e.g., Twilio for messaging, Firebase for hosting), subject to confidentiality agreements</li>
          <li><strong>Legal Requirements:</strong> When required by law, regulation, legal process, or governmental request</li>
          <li><strong>Protection:</strong> To protect the rights, property, or safety of SOLTheory, our users, or the public</li>
          <li><strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets, in which case your data would remain subject to this Privacy Policy</li>
        </ul>

        <h2 className="text-lg font-semibold text-slate-800 mt-8">8. Cookies and Tracking</h2>
        <p>We use essential cookies and local storage to maintain your authentication session and remember your preferences. We do not use third-party advertising cookies or tracking pixels.</p>

        <h2 className="text-lg font-semibold text-slate-800 mt-8">9. Data Retention</h2>
        <p>We retain your personal information for as long as your account is active or as needed to provide you services. You may request deletion of your account and associated data at any time by contacting us. Upon account deletion, we will remove your personal data within 30 days, except where retention is required by law.</p>

        <h2 className="text-lg font-semibold text-slate-800 mt-8">10. Your Rights</h2>
        <p>Depending on your jurisdiction, you may have the following rights regarding your personal data:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li><strong>Access:</strong> Request a copy of the personal data we hold about you</li>
          <li><strong>Correction:</strong> Request correction of inaccurate or incomplete data</li>
          <li><strong>Deletion:</strong> Request deletion of your personal data</li>
          <li><strong>Portability:</strong> Request a copy of your data in a structured, machine-readable format</li>
          <li><strong>Opt-Out:</strong> Disconnect any third-party integration from your Settings page at any time, which immediately revokes access and deletes stored tokens</li>
        </ul>
        <p>To exercise any of these rights, contact us at <strong>lucas@soltheory.com</strong>.</p>

        <h2 className="text-lg font-semibold text-slate-800 mt-8">11. California Residents (CCPA)</h2>
        <p>If you are a California resident, you have additional rights under the California Consumer Privacy Act (CCPA), including the right to know what personal information we collect and how it is used, the right to request deletion, and the right to opt out of the sale of personal information. We do not sell personal information.</p>

        <h2 className="text-lg font-semibold text-slate-800 mt-8">12. Children&apos;s Privacy</h2>
        <p>The Platform is not intended for children under the age of 13. We do not knowingly collect personal information from children under 13. If we become aware that we have collected data from a child under 13, we will delete it promptly.</p>

        <h2 className="text-lg font-semibold text-slate-800 mt-8">13. Changes to This Policy</h2>
        <p>We may update this Privacy Policy from time to time. Any changes will be posted on this page with an updated &quot;Last updated&quot; date. Your continued use of the Platform after any changes constitutes your acceptance of the revised policy.</p>

        <h2 className="text-lg font-semibold text-slate-800 mt-8">14. Contact Us</h2>
        <p>If you have any questions or concerns about this Privacy Policy or our data practices, please contact us at:</p>
        <p><strong>MyTaj LLC d/b/a SOLTheory</strong><br />Email: lucas@soltheory.com<br />Website: soltheory.com</p>
      </div>
    </div>
  );
}

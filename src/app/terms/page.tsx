export const metadata = {
  title: "Terms of Service | SOL Theory",
  description: "SOL Theory terms of service — rules and guidelines governing your use of our platform.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white px-8 py-16 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold text-slate-900 mb-2">Terms of Service</h1>
      <p className="text-sm text-slate-500 mb-8">Last updated: May 10, 2026</p>

      <div className="prose prose-slate text-sm space-y-4 text-slate-700 leading-relaxed">
        <p>Welcome to SOL Theory. These Terms of Service (&quot;Terms&quot;) govern your access to and use of the SOL Theory platform at <strong>soltheory.com</strong> and all related services (the &quot;Platform&quot;), operated by SOL Theory LLC (&quot;SOL Theory,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;). By accessing or using the Platform, you agree to be bound by these Terms.</p>

        <h2 className="text-lg font-semibold text-slate-800 mt-8">1. Eligibility</h2>
        <p>You must be at least 18 years old and have the legal authority to enter into these Terms. If you are using the Platform on behalf of a business or organization, you represent that you have the authority to bind that entity to these Terms.</p>

        <h2 className="text-lg font-semibold text-slate-800 mt-8">2. Account Registration</h2>
        <p>To access certain features of the Platform, you must create an account. You agree to provide accurate, current, and complete information during registration and to keep your account credentials secure. You are responsible for all activity that occurs under your account. Notify us immediately at lucas@soltheory.com if you suspect unauthorized use of your account.</p>

        <h2 className="text-lg font-semibold text-slate-800 mt-8">3. Use of the Platform</h2>
        <p>The Platform is provided for business management, communication, and productivity purposes. You agree to use the Platform only for lawful purposes and in accordance with these Terms. You agree not to:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Use the Platform to send spam, unsolicited messages, or content that violates any applicable law</li>
          <li>Attempt to gain unauthorized access to the Platform, other user accounts, or any associated systems</li>
          <li>Use the Platform to transmit malware, viruses, or other harmful code</li>
          <li>Reverse-engineer, decompile, or disassemble any part of the Platform</li>
          <li>Use the Platform in any manner that could damage, disable, or impair the service</li>
          <li>Resell or redistribute access to the Platform without our express written consent</li>
        </ul>

        <h2 className="text-lg font-semibold text-slate-800 mt-8">4. Third-Party Integrations</h2>
        <p>The Platform integrates with third-party services including but not limited to Google Workspace, QuickBooks Online, Twilio, and others. By connecting these services, you:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Authorize SOL Theory to access your data on those services as needed to provide Platform functionality</li>
          <li>Acknowledge that your use of third-party services is also subject to their respective terms of service and privacy policies</li>
          <li>Understand that SOL Theory is not responsible for the availability, accuracy, or security of third-party services</li>
          <li>May revoke access to any connected service at any time through your Settings page</li>
        </ul>

        <h2 className="text-lg font-semibold text-slate-800 mt-8">5. SMS/Text Messaging Service</h2>
        <p>The Platform includes an SMS messaging feature powered by Twilio. By activating and using this feature, you agree to the following:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>You will only send messages to individuals who have given their consent to receive communications from you</li>
          <li>You will comply with all applicable laws and regulations regarding text messaging, including the Telephone Consumer Protection Act (TCPA) and CAN-SPAM Act</li>
          <li>You will honor all opt-out (STOP) requests promptly</li>
          <li>You are solely responsible for the content of messages you send through the Platform</li>
          <li>Standard message and data rates from your mobile carrier may apply to messages sent and received</li>
          <li>Message frequency varies based on your usage of the Platform</li>
          <li>SOL Theory reserves the right to suspend or terminate your messaging capabilities if you violate these terms or applicable laws</li>
        </ul>
        <p>To opt out of receiving messages, reply <strong>STOP</strong> to any message. To get help, reply <strong>HELP</strong> to any message or contact lucas@soltheory.com.</p>

        <h2 className="text-lg font-semibold text-slate-800 mt-8">6. SOLTheory SMS Program Terms</h2>
        <p>By opting in to receive SMS notifications from SOLTheory, you consent to receive business notifications, appointment reminders, invoice updates, and customer support messages. Message frequency varies based on your interactions with us. Message and data rates may apply.</p>
        <p>You can cancel the SMS service at any time. Simply reply &quot;STOP&quot; to any text message we send. Upon receiving &quot;STOP,&quot; we will confirm your unsubscribe status via SMS. Following this, you will no longer receive SMS messages from us unless you re-register. For help, you can reply &quot;HELP&quot; or contact us directly at <strong>support@soltheory.com</strong>.</p>

        <h2 className="text-lg font-semibold text-slate-800 mt-8">7. AI Assistant (Jarvis)</h2>
        <p>The Platform includes an AI-powered assistant (&quot;Jarvis&quot;) that can perform tasks on your behalf, including drafting communications, managing calendars, and providing business insights. You acknowledge that:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>AI-generated content may not always be accurate and should be reviewed before use</li>
          <li>You are responsible for verifying and approving any actions taken by the AI assistant</li>
          <li>AI interactions may be stored to improve service quality and provide conversational continuity</li>
          <li>The AI assistant operates within the permissions and integrations you have authorized</li>
        </ul>

        <h2 className="text-lg font-semibold text-slate-800 mt-8">8. Intellectual Property</h2>
        <p>The Platform, including its design, code, features, logos, and content, is the intellectual property of SOL Theory LLC and is protected by copyright, trademark, and other intellectual property laws. You may not copy, modify, distribute, or create derivative works based on the Platform without our express written consent.</p>

        <h2 className="text-lg font-semibold text-slate-800 mt-8">9. Payment and Billing</h2>
        <p>Certain features of the Platform may require payment. By subscribing to a paid plan, you agree to pay all applicable fees as described at the time of purchase. Fees are non-refundable except as required by law. We reserve the right to change pricing with 30 days&apos; notice.</p>

        <h2 className="text-lg font-semibold text-slate-800 mt-8">10. Data Handling</h2>
        <p>Your use of the Platform is also governed by our <a href="/privacy" className="text-emerald-600 underline hover:text-emerald-700">Privacy Policy</a>, which describes how we collect, use, and protect your personal information. All authentication tokens and credentials are stored securely in your private database. We do not share, sell, or distribute your data to any third parties for marketing purposes.</p>

        <h2 className="text-lg font-semibold text-slate-800 mt-8">11. Disclaimer of Warranties</h2>
        <p>THE PLATFORM IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. SOL THEORY DOES NOT WARRANT THAT THE PLATFORM WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE.</p>

        <h2 className="text-lg font-semibold text-slate-800 mt-8">12. Limitation of Liability</h2>
        <p>TO THE MAXIMUM EXTENT PERMITTED BY LAW, SOL THEORY LLC AND ITS OFFICERS, DIRECTORS, EMPLOYEES, AND AGENTS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, OR BUSINESS OPPORTUNITIES, ARISING OUT OF OR RELATED TO YOUR USE OF THE PLATFORM, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES. OUR TOTAL LIABILITY SHALL NOT EXCEED THE AMOUNT PAID BY YOU TO SOL THEORY IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM.</p>

        <h2 className="text-lg font-semibold text-slate-800 mt-8">13. Indemnification</h2>
        <p>You agree to indemnify, defend, and hold harmless SOL Theory LLC and its officers, directors, employees, and agents from and against any claims, liabilities, damages, losses, and expenses (including reasonable attorneys&apos; fees) arising out of or related to your use of the Platform, your violation of these Terms, or your violation of any law or rights of a third party.</p>

        <h2 className="text-lg font-semibold text-slate-800 mt-8">14. Termination</h2>
        <p>We may suspend or terminate your access to the Platform at any time, with or without cause, and with or without notice. Upon termination, your right to use the Platform will immediately cease. Provisions of these Terms that by their nature should survive termination will remain in effect.</p>

        <h2 className="text-lg font-semibold text-slate-800 mt-8">15. Governing Law</h2>
        <p>These Terms shall be governed by and construed in accordance with the laws of the State of Colorado, without regard to its conflict of law provisions. Any disputes arising under these Terms shall be resolved in the state or federal courts located in Colorado.</p>

        <h2 className="text-lg font-semibold text-slate-800 mt-8">16. Changes to These Terms</h2>
        <p>We reserve the right to modify these Terms at any time. Any changes will be posted on this page with an updated &quot;Last updated&quot; date. Your continued use of the Platform after any changes constitutes your acceptance of the revised Terms. We encourage you to review these Terms periodically.</p>

        <h2 className="text-lg font-semibold text-slate-800 mt-8">17. Contact Us</h2>
        <p>If you have any questions about these Terms, please contact us at:</p>
        <p><strong>SOL Theory LLC</strong><br />Email: lucas@soltheory.com<br />Website: soltheory.com</p>
      </div>
    </div>
  );
}

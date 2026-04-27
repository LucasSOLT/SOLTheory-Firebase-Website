export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white px-8 py-16 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold text-slate-900 mb-6">Privacy Policy</h1>
      <p className="text-sm text-slate-500 mb-8">Last updated: {new Date().toLocaleDateString()}</p>
      
      <div className="prose prose-slate text-sm space-y-4">
        <p>SOL Theory is committed to protecting your privacy. This policy explains how we handle your data.</p>
        
        <h2 className="text-lg font-semibold text-slate-800 mt-6">1. Information We Collect</h2>
        <p>We collect only the information necessary to provide our services: your name, email address, and authentication tokens for connected third-party services (Google, QuickBooks, etc.).</p>
        
        <h2 className="text-lg font-semibold text-slate-800 mt-6">2. How We Use Your Information</h2>
        <p>Your information is used solely to display relevant data within your personal dashboard. We use read-only access to connected services and never modify your external data.</p>
        
        <h2 className="text-lg font-semibold text-slate-800 mt-6">3. Data Storage</h2>
        <p>All data is stored securely using Google Firebase/Firestore with industry-standard encryption. Authentication tokens are stored in your private user document and are not accessible to other users.</p>
        
        <h2 className="text-lg font-semibold text-slate-800 mt-6">4. Third-Party Sharing</h2>
        <p>We do not sell, trade, or share your personal information with third parties. Data from connected services (QuickBooks, Google) is only displayed within your dashboard and is never transmitted elsewhere.</p>
        
        <h2 className="text-lg font-semibold text-slate-800 mt-6">5. Your Rights</h2>
        <p>You can disconnect any third-party integration at any time from your Settings page, which will immediately revoke access and delete stored tokens. You may request full data deletion by contacting us.</p>
        
        <h2 className="text-lg font-semibold text-slate-800 mt-6">6. Contact</h2>
        <p>For privacy-related questions, contact lucas@soltheory.com.</p>
      </div>
    </div>
  );
}

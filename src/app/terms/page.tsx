export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white px-8 py-16 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold text-slate-900 mb-6">Terms of Service</h1>
      <p className="text-sm text-slate-500 mb-8">Last updated: {new Date().toLocaleDateString()}</p>
      
      <div className="prose prose-slate text-sm space-y-4">
        <p>Welcome to SOL Theory. By using our platform, you agree to the following terms.</p>
        
        <h2 className="text-lg font-semibold text-slate-800 mt-6">1. Use of Service</h2>
        <p>This platform is provided for internal business management purposes. Users must have authorized access to use dashboard features and integrations.</p>
        
        <h2 className="text-lg font-semibold text-slate-800 mt-6">2. Third-Party Integrations</h2>
        <p>Our platform integrates with third-party services including Google Workspace, QuickBooks Online, and others. By connecting these services, you authorize read-only access to display relevant data within your dashboard. We do not modify, delete, or alter any data in your connected accounts.</p>
        
        <h2 className="text-lg font-semibold text-slate-800 mt-6">3. Data Handling</h2>
        <p>All authentication tokens and credentials are stored securely in your private database. We do not share, sell, or distribute your data to any third parties.</p>
        
        <h2 className="text-lg font-semibold text-slate-800 mt-6">4. Limitation of Liability</h2>
        <p>This platform is provided &quot;as is&quot; without warranties of any kind. We are not liable for any damages arising from the use of this service.</p>
        
        <h2 className="text-lg font-semibold text-slate-800 mt-6">5. Contact</h2>
        <p>For questions regarding these terms, please contact lucas@soltheory.com.</p>
      </div>
    </div>
  );
}

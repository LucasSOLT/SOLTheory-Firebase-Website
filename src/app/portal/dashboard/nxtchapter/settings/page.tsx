import { Header } from "@/components/sections/header";
import { Footer } from "@/components/sections/footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { ArrowLeft, Bell, Lock, User, Globe } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="flex flex-col min-h-screen bg-[#0a0c10] text-slate-200">
      <Header />
      <main className="flex-grow py-8 px-4 md:px-8">
        <div className="w-full max-w-4xl mx-auto space-y-6">
          <div className="flex items-center gap-4">
            <Link href="/portal/dashboard/nxtchapter" className="p-2 hover:bg-slate-800 rounded-md transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-3xl font-bold text-white">Settings</h1>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="space-y-2 md:col-span-1 border-r border-slate-800 pr-4">
              <Button variant="ghost" className="w-full justify-start bg-slate-800/80 text-white cursor-default">
                <User className="w-4 h-4 mr-2" /> Profile
              </Button>
              <Button variant="ghost" className="w-full justify-start text-slate-400 cursor-not-allowed">
                <Bell className="w-4 h-4 mr-2" /> Notifications
              </Button>
              <Button variant="ghost" className="w-full justify-start text-slate-400 cursor-not-allowed">
                <Lock className="w-4 h-4 mr-2" /> Security
              </Button>
              <Button variant="ghost" className="w-full justify-start text-slate-400 cursor-not-allowed">
                <Globe className="w-4 h-4 mr-2" /> Region & Language
              </Button>
            </div>

            <div className="md:col-span-3 space-y-6">
              <Card className="bg-slate-900/50 border-slate-800">
                <CardHeader>
                  <CardTitle className="text-xl text-white">Public Profile</CardTitle>
                  <CardDescription className="text-slate-400">
                    This information will be displayed to other users in your organization.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-slate-300">Display Name</Label>
                    <Input id="name" defaultValue="John Doe" className="bg-slate-800/50 border-slate-700 max-w-md" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-slate-300">Contact Email</Label>
                    <Input id="email" type="email" defaultValue="j.doe@example.org" className="bg-slate-800/50 border-slate-700 max-w-md" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-slate-900/50 border-slate-800">
                <CardHeader>
                  <CardTitle className="text-xl text-white">Email Preferences</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base text-slate-200">Daily Digest</Label>
                      <p className="text-sm text-slate-400">Receive a daily summary of organization metrics.</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base text-slate-200">System Alerts</Label>
                      <p className="text-sm text-slate-400">Critical notifications about platform updates.</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end gap-4 pb-8">
                <Button variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800">Cancel</Button>
                <Button className="bg-blue-600 hover:bg-blue-700">Save Changes</Button>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

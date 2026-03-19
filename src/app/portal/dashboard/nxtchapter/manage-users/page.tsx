import { Header } from "@/components/sections/header";
import { Footer } from "@/components/sections/footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function ManageUsersPage() {
  const users = [
    { id: 1, name: "Sarah Jenkins", email: "s.jenkins@example.org", role: "Case Worker", status: "Active" },
    { id: 2, name: "Marcus Rivera", email: "m.rivera@example.org", role: "Administrator", status: "Active" },
    { id: 3, name: "Chloe Thompson", email: "c.thompson@example.org", role: "Volunteer", status: "Inactive" },
    { id: 4, name: "David Chen", email: "d.chen@example.org", role: "Case Worker", status: "Active" },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0c10] text-slate-200">
      <Header />
      <main className="flex-grow py-8 px-4 md:px-8">
        <div className="w-full max-w-6xl mx-auto space-y-6">
          <div className="flex items-center gap-4">
            <Link href="/portal/dashboard/nxtchapter" className="p-2 hover:bg-slate-800 rounded-md transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-3xl font-bold text-white">Manage Users</h1>
          </div>

          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-4">
              <div className="relative flex-grow max-w-md w-full">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                <Input
                  type="search"
                  placeholder="Search users..."
                  className="w-full bg-slate-800/50 border-slate-700 pl-9"
                />
              </div>
              <Button className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto">
                <Plus className="w-4 h-4 mr-2" /> Add User
              </Button>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border border-slate-800 overflow-hidden">
                <Table>
                  <TableHeader className="bg-slate-800/50">
                    <TableRow className="border-slate-800 hover:bg-slate-800/50">
                      <TableHead className="text-slate-300">Name</TableHead>
                      <TableHead className="text-slate-300">Email</TableHead>
                      <TableHead className="text-slate-300">Role</TableHead>
                      <TableHead className="text-slate-300">Status</TableHead>
                      <TableHead className="text-right text-slate-300">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id} className="border-slate-800 hover:bg-slate-800/30">
                        <TableCell className="font-medium text-white">{user.name}</TableCell>
                        <TableCell className="text-slate-400">{user.email}</TableCell>
                        <TableCell>{user.role}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            user.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-500/10 text-slate-400'
                          }`}>
                            {user.status}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}

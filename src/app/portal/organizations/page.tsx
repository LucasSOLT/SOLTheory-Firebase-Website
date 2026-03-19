import Link from "next/link";
import { Header } from "@/components/sections/header";
import { Footer } from "@/components/sections/footer";
import { Card, CardContent } from "@/components/ui/card";
import { Building2 } from "lucide-react";

export default function OrganizationsPage() {
  const organizations = [
    {
      id: "nxtchapter",
      name: "NXT Chapter",
      href: "/portal/dashboard/nxtchapter",
      isActive: true,
    },
    { id: "org2", name: "Organization 2", href: "#", isActive: false },
    { id: "org3", name: "Organization 3", href: "#", isActive: false },
    { id: "org4", name: "Organization 4", href: "#", isActive: false },
    { id: "org5", name: "Organization 5", href: "#", isActive: false },
    { id: "org6", name: "Organization 6", href: "#", isActive: false },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />
      <main className="flex-grow flex items-center justify-center pt-24 pb-12">
        <div className="w-full max-w-4xl px-4">
          <h1 className="text-3xl font-bold text-center mb-8">Select Organization</h1>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            {organizations.map((org) => {
              const content = (
                <Card className={`h-full transition-all hover:border-primary/50 hover:shadow-md ${!org.isActive && "opacity-60 grayscale cursor-not-allowed"}`}>
                  <CardContent className="flex flex-col items-center justify-center p-6 h-48">
                    <div className="w-20 h-20 bg-muted rounded-xl mb-4 flex items-center justify-center overflow-hidden">
                      {/* Image placeholder */}
                      <Building2 className="w-10 h-10 text-muted-foreground" />
                    </div>
                    {org.isActive && <span className="font-semibold text-center">{org.name}</span>}
                  </CardContent>
                </Card>
              );

              return org.isActive ? (
                <Link key={org.id} href={org.href}>
                  {content}
                </Link>
              ) : (
                <div key={org.id}>{content}</div>
              );
            })}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

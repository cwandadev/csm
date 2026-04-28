// csms-frontend/src/pages/dashboard/Reports.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download } from "lucide-react";

const Reports = () => (
  <div className="space-y-6 animate-fade-in max-w-3xl">
    <div>
      <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2"><FileText className="h-6 w-6 text-primary" /> Reports</h1>
      <p className="text-muted-foreground text-sm mt-1">Download and schedule automated reports.</p>
    </div>
    {[
      { title: "Daily Attendance Report", desc: "Summary of today's attendance across all devices.", format: "CSV" },
      { title: "Monthly Analytics Report", desc: "Comprehensive analytics for the current month.", format: "PDF" },
      { title: "User Activity Report", desc: "Detailed user check-in/check-out history.", format: "Excel" },
      { title: "Device Health Report", desc: "Status and uptime of all connected devices.", format: "PDF" },
      { title: "Account Activity Report", desc: "Admin and logins of all Account Activities.", format: "PDF" },
    ].map((r, i) => (
      <Card key={i} className="border-0 shadow-sm bg-card">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><FileText className="h-5 w-5 text-primary" /></div>
            <div><h3 className="font-heading font-semibold text-foreground text-sm">{r.title}</h3><p className="text-xs text-muted-foreground">{r.desc}</p></div>
          </div>
          <Button variant="outline" size="sm"><Download className="h-3 w-3 mr-1" />{r.format}</Button>
        </CardContent>
      </Card>
    ))}
  </div>
);

export default Reports;

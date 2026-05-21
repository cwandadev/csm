import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  change?: string;
  positive?: boolean;
}

const StatCard = ({ title, value, icon: Icon, change, positive }: StatCardProps) => (
  <Card className="border-0 shadow-sm hover:shadow-md transition-shadow bg-card">
    <CardContent className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-2xl font-heading font-bold text-foreground mt-1">{value}</p>
          {change && (
            <p className={`text-xs mt-1 font-medium ${positive ? "text-success" : "text-destructive"}`}>
              {positive ? "↑" : "↓"} {change}
            </p>
          )}
        </div>
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Icon className="h-5 w-5 text-primary" />
        </div>
      </div>
    </CardContent>
  </Card>
);

export default StatCard;

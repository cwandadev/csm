// csms-frontend/src/page/dashboard/Notifications.tsx
import { Card, CardContent } from "@/components/ui/card";
import { Bell, CheckCircle, AlertTriangle, Info } from "lucide-react";

const notifications = [
  { id: 1, type: "info", title: "System Update", message: "CSM Platform v2.1 is now available with new fingerprint support.", time: "2 hours ago" },
  { id: 2, type: "success", title: "Device Connected", message: "Lab A Scanner is back online.", time: "5 hours ago" },
  { id: 3, type: "warning", title: "Low Attendance", message: "Today's attendance is below 85% threshold.", time: "1 day ago" },
  { id: 4, type: "info", title: "New User Added", message: "Patrick Niyonzima was added to HR department.", time: "2 days ago" },
  { id: 5, type: "warning", title: "Subscription Expiring", message: "Your free trial expires in 5 days.", time: "3 days ago" },
];

const iconMap = { info: Info, success: CheckCircle, warning: AlertTriangle };
const colorMap = { info: "text-info", success: "text-success", warning: "text-warning" };
const bgMap = { info: "bg-info/10", success: "bg-success/10", warning: "bg-warning/10" };

const Notifications = () => (
  <div className="space-y-6 animate-fade-in max-w-3xl">
    <div>
      <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2"><Bell className="h-6 w-6 text-primary" /> Notifications</h1>
      <p className="text-muted-foreground text-sm mt-1">Stay updated with changes and alerts.</p>
    </div>
    
    {/* Coming Soon Blur Overlay */}
    <div className="relative">
      <div className="space-y-3 blur-sm pointer-events-none select-none">
        {notifications.map(n => {
          const Icon = iconMap[n.type as keyof typeof iconMap];
          return (
            <Card key={n.id} className="border-0 shadow-sm bg-card">
              <CardContent className="p-4 flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl ${bgMap[n.type as keyof typeof bgMap]} flex items-center justify-center shrink-0`}>
                  <Icon className={`h-5 w-5 ${colorMap[n.type as keyof typeof colorMap]}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                    <h3 className="font-heading font-semibold text-foreground text-sm">{n.title}</h3>
                    <span className="text-xs text-muted-foreground shrink-0 ml-2">{n.time}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">{n.message}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      
      {/* Centered Coming Soon Overlay */}
      <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-md rounded-xl">
        <div className="text-center space-y-3">
          <div className="w-20 h-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
            <Bell className="h-10 w-10 text-primary" />
          </div>
          <h2 className="text-3xl md:text-4xl font-heading font-bold text-foreground">
            Coming Soon!
          </h2>
          <p className="text-muted-foreground text-sm">
            We're working on something amazing. Stay tuned!
          </p>
        </div>
      </div>
    </div>
  </div>
);

export default Notifications;

// // csms-frontend/src/page/dashboard/Notifications.tsx
// import { Card, CardContent } from "@/components/ui/card";
// import { Bell, CheckCircle, AlertTriangle, Info } from "lucide-react";

// const notifications = [
//   { id: 1, type: "info", title: "System Update", message: "CSM Platform v2.1 is now available with new fingerprint support.", time: "2 hours ago" },
//   { id: 2, type: "success", title: "Device Connected", message: "Lab A Scanner is back online.", time: "5 hours ago" },
//   { id: 3, type: "warning", title: "Low Attendance", message: "Today's attendance is below 85% threshold.", time: "1 day ago" },
//   { id: 4, type: "info", title: "New User Added", message: "Patrick Niyonzima was added to HR department.", time: "2 days ago" },
//   { id: 5, type: "warning", title: "Subscription Expiring", message: "Your free trial expires in 5 days.", time: "3 days ago" },
// ];

// const iconMap = { info: Info, success: CheckCircle, warning: AlertTriangle };
// const colorMap = { info: "text-info", success: "text-success", warning: "text-warning" };
// const bgMap = { info: "bg-info/10", success: "bg-success/10", warning: "bg-warning/10" };

// const Notifications = () => (
//   <div className="space-y-6 animate-fade-in max-w-3xl">
//     <div>
//       <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2"><Bell className="h-6 w-6 text-primary" /> Notifications</h1>
//       <p className="text-muted-foreground text-sm mt-1">Stay updated with changes and alerts.</p>
//     </div>
//     <div className="space-y-3">
//       {notifications.map(n => {
//         const Icon = iconMap[n.type as keyof typeof iconMap];
//         return (
//           <Card key={n.id} className="border-0 shadow-sm bg-card hover:shadow-md transition-shadow">
//             <CardContent className="p-4 flex items-start gap-3">
//               <div className={`w-10 h-10 rounded-xl ${bgMap[n.type as keyof typeof bgMap]} flex items-center justify-center shrink-0`}>
//                 <Icon className={`h-5 w-5 ${colorMap[n.type as keyof typeof colorMap]}`} />
//               </div>
//               <div className="flex-1 min-w-0">
//                 <div className="flex justify-between items-start">
//                   <h3 className="font-heading font-semibold text-foreground text-sm">{n.title}</h3>
//                   <span className="text-xs text-muted-foreground shrink-0 ml-2">{n.time}</span>
//                 </div>
//                 <p className="text-sm text-muted-foreground mt-0.5">{n.message}</p>
//               </div>
//             </CardContent>
//           </Card>
//         );
//       })}
//     </div>
//   </div>
// );

// export default Notifications;

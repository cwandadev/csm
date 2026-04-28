import { Fingerprint } from "lucide-react";

const AuthBrandPanel = () => (
  <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden gradient-primary flex-col items-center justify-center p-12 text-primary-foreground">
    {/* Background decorative circles */}
    <div className="absolute -top-20 -left-20 w-72 h-72 rounded-full bg-white/10" />
    <div className="absolute -bottom-32 -right-20 w-96 h-96 rounded-full bg-white/5" />
    <div className="absolute top-1/2 left-1/4 w-48 h-48 rounded-full bg-white/5" />

    <div className="relative z-10 text-center space-y-6 max-w-md">
      <div className="mx-auto w-20 h-20 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center shadow-lg">
        <Fingerprint className="h-10 w-10 text-white" />
      </div>
      <h1 className="text-3xl font-heading font-bold">CSM Platform</h1>
      <p className="text-white/80 font-body text-sm leading-relaxed">
        Centralized Service &amp; School Management — IoT-powered smart attendance tracking for schools and organizations across Rwanda.
      </p>
      <div className="flex items-center justify-center gap-6 pt-4">
        {[
          { value: "500+", label: "Organizations" },
          { value: "1M+", label: "Users" },
          { value: "99.9%", label: "Uptime" },
        ].map((stat, i) => (
          <div key={i} className="text-center">
            <div className="text-2xl font-heading font-bold">{stat.value}</div>
            <div className="text-xs text-white/70">{stat.label}</div>
            {i < 2 && (
              <div className="absolute" style={{ display: "none" }} />
            )}
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default AuthBrandPanel;

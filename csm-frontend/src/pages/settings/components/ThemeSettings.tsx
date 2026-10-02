// csms-frontend/src/pages/settings/components/ThemeSettings.tsx
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Sun, Moon, Monitor, Palette, Check } from "lucide-react";
import { SettingsTabProps } from "../types";

type ThemeMode = "light" | "dark" | "system";
type ThemeColor = "blue" | "purple" | "green" | "orange" | "red";

const ThemeSettings = ({ admin, onToast }: SettingsTabProps) => {
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem("theme_mode") as ThemeMode;
    return saved || "system";
  });
  const [themeColor, setThemeColor] = useState<ThemeColor>(() => {
    const saved = localStorage.getItem("theme_color") as ThemeColor;
    return saved || "blue";
  });
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const isDark = localStorage.getItem("csm_darkmode") === "true";
    setDarkMode(isDark);
  }, []);

  const applyThemeColor = (color: ThemeColor) => {
    const root = document.documentElement;
    const colorMap = {
      blue: { primary: "#3b82f6", primaryDark: "#2563eb", primaryLight: "#eff6ff" },
      purple: { primary: "#8b5cf6", primaryDark: "#7c3aed", primaryLight: "#f5f3ff" },
      green: { primary: "#22c55e", primaryDark: "#16a34a", primaryLight: "#f0fdf4" },
      orange: { primary: "#f97316", primaryDark: "#ea580c", primaryLight: "#fff7ed" },
      red: { primary: "#ef4444", primaryDark: "#dc2626", primaryLight: "#fef2f2" },
    };
    
    const colors = colorMap[color];
    root.style.setProperty("--primary", colors.primary);
    root.style.setProperty("--primary-dark", colors.primaryDark);
    root.style.setProperty("--primary-light", colors.primaryLight);
    
    const style = document.createElement('style');
    style.textContent = `
      .gradient-primary { background: linear-gradient(135deg, ${colors.primary}, ${colors.primaryDark}); }
      .gradient-primary:hover { background: linear-gradient(135deg, ${colors.primaryDark}, ${colors.primary}); }
    `;
    const oldStyle = document.getElementById('theme-color-style');
    if (oldStyle) oldStyle.remove();
    style.id = 'theme-color-style';
    document.head.appendChild(style);
  };

  const handleThemeModeChange = (mode: ThemeMode) => {
    setThemeMode(mode);
    localStorage.setItem("theme_mode", mode);
    
    if (mode === "system") {
      const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      if (systemDark !== darkMode) {
        toggleDarkMode();
      }
    } else if (mode === "dark" && !darkMode) {
      toggleDarkMode();
    } else if (mode === "light" && darkMode) {
      toggleDarkMode();
    }
    
    onToast?.(`Theme changed to ${mode}`, "info");
  };

  const toggleDarkMode = () => {
    const newDark = !darkMode;
    setDarkMode(newDark);
    localStorage.setItem("csm_darkmode", String(newDark));
    document.documentElement.classList.toggle("dark", newDark);
  };

  const handleThemeColorChange = (color: ThemeColor) => {
    setThemeColor(color);
    localStorage.setItem("theme_color", color);
    applyThemeColor(color);
    onToast?.(`Color scheme changed to ${color}`, "info");
  };

  return (
    <div className="space-y-6">
      {/* Theme Mode */}
      <div>
        <Label className="text-base font-semibold">Theme Mode</Label>
        <p className="text-sm text-muted-foreground mb-3">Choose your preferred theme mode</p>
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => handleThemeModeChange("light")}
            className={`flex items-center justify-center gap-2 py-3 px-4 rounded-lg border-2 transition-all ${
              themeMode === "light" ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
            }`}
          >
            <Sun className="h-5 w-5" /> Light
          </button>
          <button
            onClick={() => handleThemeModeChange("dark")}
            className={`flex items-center justify-center gap-2 py-3 px-4 rounded-lg border-2 transition-all ${
              themeMode === "dark" ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
            }`}
          >
            <Moon className="h-5 w-5" /> Dark
          </button>
          <button
            onClick={() => handleThemeModeChange("system")}
            className={`flex items-center justify-center gap-2 py-3 px-4 rounded-lg border-2 transition-all ${
              themeMode === "system" ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
            }`}
          >
            <Monitor className="h-5 w-5" /> System
          </button>
        </div>
      </div>

      <Separator />

      {/* Color Palette */}
      <div>
        <Label className="text-base font-semibold flex items-center gap-2"><Palette className="h-4 w-4" /> Color Palette</Label>
        <p className="text-sm text-muted-foreground mb-3">Choose your primary accent color</p>
        <div className="flex gap-4 flex-wrap">
          {[
            { name: "blue", color: "bg-blue-500", ring: "ring-blue-500" },
            { name: "purple", color: "bg-purple-500", ring: "ring-purple-500" },
            { name: "green", color: "bg-green-500", ring: "ring-green-500" },
            { name: "orange", color: "bg-orange-500", ring: "ring-orange-500" },
            { name: "red", color: "bg-red-500", ring: "ring-red-500" },
          ].map((color) => (
            <button
              key={color.name}
              onClick={() => handleThemeColorChange(color.name as ThemeColor)}
              className={`w-12 h-12 ${color.color} rounded-full transition-all ${
                themeColor === color.name ? `ring-4 ring-offset-2 ring-offset-background ${color.ring} scale-110` : "hover:scale-105"
              }`}
              title={color.name}
            />
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-3">Current color: <span className="capitalize font-medium">{themeColor}</span></p>
      </div>

      <Separator />

      {/* Preview */}
      <div className="p-4 rounded-lg border border-border bg-accent/20">
        <p className="text-sm font-medium mb-3">Preview</p>
        <div className="flex gap-3 flex-wrap">
          <Button className="gradient-primary">Primary Button</Button>
          <Button variant="outline">Outline Button</Button>
          <Button variant="ghost">Ghost Button</Button>
        </div>
        <div className="mt-3 p-3 rounded-lg bg-primary/10">
          <p className="text-sm text-primary">This is how your primary color will look</p>
        </div>
      </div>
    </div>
  );
};

export default ThemeSettings;
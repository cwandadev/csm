// csms-frontend/src/pages/dashboard/Reports.tsx
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, FileText, Download, Loader2, Eye, Search, Printer, X } from "lucide-react";
import { Clock,
TrendingUp,
Users,
Smartphone,
UserCheck } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import api from "@/lib/api";

interface ReportConfig {
  type: string;
  format: "csv" | "pdf" | "excel" | "json";
  timeRange: "daily" | "weekly" | "monthly" | "yearly" | "custom";
  dateRange: {
    start: Date;
    end: Date;
  };
  searchTerm?: string;
}

interface ReportStats {
  hasData: boolean;
  recordCount: number;
}

interface PDFViewerProps {
  isOpen: boolean;
  onClose: () => void;
  reportData: any;
  reportTitle: string;
  reportType: string;
  organizationName: string;
  dateRange: { start: Date; end: Date };
}

// PDF Viewer Component
const PDFViewer = ({ isOpen, onClose, reportData, reportTitle, reportType, organizationName, dateRange }: PDFViewerProps) => {
  const [isPrinting, setIsPrinting] = useState(false);

  if (!isOpen) return null;

  const handlePrint = () => {
    setIsPrinting(true);
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 100);
  };

  const formatDate = (date: Date) => {
    return format(date, "MMMM dd, yyyy");
  };

  const formatDateTime = (dateStr: string) => {
    return format(new Date(dateStr), "MMM dd, yyyy hh:mm a");
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'check_in':
      case 'present':
        return 'text-green-600';
      case 'check_out':
        return 'text-blue-600';
      case 'late':
        return 'text-orange-600';
      case 'absent':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getMethodIcon = (method: string) => {
    switch (method?.toLowerCase()) {
      case 'card':
        return '💳';
      case 'fingerprint':
        return '👆';
      case 'manual':
        return '✏️';
      default:
        return '📱';
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="text-xl font-bold">{reportTitle}</h2>
            <p className="text-sm text-gray-500">
              {organizationName} • {formatDate(dateRange.start)} - {formatDate(dateRange.end)}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint} disabled={isPrinting}>
              <Printer className="h-4 w-4 mr-2" />
              {isPrinting ? "Printing..." : "Print"}
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* PDF Content - This will be printed */}
        <div className="flex-1 overflow-auto p-6" id="pdf-content">
          <div className="max-w-4xl mx-auto">
            {/* Report Header */}
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold mb-2">{reportTitle}</h1>
              <p className="text-gray-600">{organizationName}</p>
              <p className="text-gray-500 text-sm">
                Generated: {format(new Date(), "MMMM dd, yyyy hh:mm a")}
              </p>
              <p className="text-gray-500 text-sm">
                Period: {formatDate(dateRange.start)} - {formatDate(dateRange.end)}
              </p>
            </div>

            {/* Summary Cards */}
            {reportData?.summary && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {Object.entries(reportData.summary).map(([key, value]) => {
                  if (typeof value === 'object') return null;
                  return (
                    <div key={key} className="bg-gray-50 rounded-lg p-4 text-center">
                      <p className="text-xs text-gray-500 uppercase">{key.replace(/_/g, ' ')}</p>
                      <p className="text-2xl font-bold">{String(value)}</p>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Method Distribution */}
            {reportData?.summary?.by_method && (
              <div className="mb-8">
                <h3 className="text-lg font-semibold mb-3">Attendance Methods</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {Object.entries(reportData.summary.by_method).map(([method, count]) => (
                    <div key={method} className="bg-gray-50 rounded-lg p-3 flex justify-between items-center">
                      <span>{getMethodIcon(method)} {method}</span>
                      <span className="font-bold">{String(count)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Daily Trend Chart (Text-based) */}
            {reportData?.daily_trend && reportData.daily_trend.length > 0 && (
              <div className="mb-8">
                <h3 className="text-lg font-semibold mb-3">Daily Attendance Trend</h3>
                <div className="space-y-2">
                  {reportData.daily_trend.slice(0, 15).map((day: any) => {
                    const totalUsers = reportData.user_statistics?.total_users || 100;
                    const percentage = (day.total_attendance / totalUsers) * 100;
                    const barLength = Math.min(50, Math.floor(percentage / 2));
                    const bar = '█'.repeat(barLength);
                    return (
                      <div key={day.date} className="flex items-center gap-2 text-sm">
                        <span className="w-24 text-gray-600">{format(new Date(day.date), "MMM dd")}</span>
                        <span className="font-mono text-blue-600">{bar}</span>
                        <span className="text-gray-500">{day.total_attendance} ({percentage.toFixed(1)}%)</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Records Table */}
            {(() => {
              let records = reportData?.records || reportData?.user_activities || reportData?.devices || [];
              if (records.length > 0) {
                const headers = Object.keys(records[0]).slice(0, 8);
                return (
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Detailed Records</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="bg-gray-100">
                            {headers.map((header) => (
                              <th key={header} className="border p-2 text-left font-semibold">
                                {header.replace(/_/g, ' ').toUpperCase()}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {records.slice(0, 50).map((record: any, idx: number) => (
                            <tr key={idx} className="border-b hover:bg-gray-50">
                              {headers.map((header) => {
                                let value = record[header];
                                if (value instanceof Date) value = format(value, "MMM dd, yyyy HH:mm");
                                if (typeof value === 'object') value = JSON.stringify(value);
                                if (header === 'status') {
                                  return (
                                    <td key={header} className="border p-2">
                                      <span className={getStatusColor(value)}>{String(value || '-')}</span>
                                    </td>
                                  );
                                }
                                return (
                                  <td key={header} className="border p-2">
                                    {String(value || '-').substring(0, 30)}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {records.length > 50 && (
                        <p className="text-sm text-gray-500 mt-2 text-center">
                          ... and {records.length - 50} more records
                        </p>
                      )}
                    </div>
                  </div>
                );
              }
              return null;
            })()}

            {/* Footer */}
            <div className="mt-8 pt-4 border-t text-center text-xs text-gray-400">
              <p>Generated by CSMS System • {new Date().toISOString()}</p>
              <p>This is an official report from your attendance management system</p>
            </div>
          </div>
        </div>

        {/* Print Styles */}
        <style dangerouslySetInnerHTML={{
          __html: `
            @media print {
              body * {
                visibility: hidden;
              }
              #pdf-content, #pdf-content * {
                visibility: visible;
              }
              #pdf-content {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                margin: 0;
                padding: 20px;
              }
              .no-print {
                display: none !important;
              }
              button, .print-hide {
                display: none !important;
              }
              @page {
                size: portrait;
                margin: 1cm;
              }
            }
          `
        }} />
      </div>
    </div>
  );
};

const Reports = () => {
  const { admin } = useAuth();
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [showPDFViewer, setShowPDFViewer] = useState(false);
  const [reportStats, setReportStats] = useState<Record<string, ReportStats>>({});
  const [searchValue, setSearchValue] = useState("");
  const [reportConfig, setReportConfig] = useState<ReportConfig>({
    type: "daily_attendance",
    format: "pdf",
    timeRange: "daily",
    dateRange: {
      start: new Date(),
      end: new Date(),
    },
    searchTerm: ""
  });

  const reportTypes = [
    { 
      id: "daily_attendance", 
      title: "Daily Attendance Report", 
      desc: "Summary of today's attendance across all devices.",
      icon: <Clock className="h-4 w-4" />,
      formats: ["csv", "pdf", "excel"],
      color: "text-blue-500",
      bgColor: "bg-blue-500/10"
    },
    { 
      id: "monthly_analytics", 
      title: "Monthly Analytics Report", 
      desc: "Comprehensive analytics for the current month.",
      icon: <TrendingUp className="h-4 w-4" />,
      formats: ["pdf", "excel", "json"],
      color: "text-purple-500",
      bgColor: "bg-purple-500/10"
    },
    { 
      id: "user_activity", 
      title: "User Activity Report", 
      desc: "Detailed user check-in/check-out history.",
      icon: <Users className="h-4 w-4" />,
      formats: ["excel", "csv", "pdf"],
      color: "text-green-500",
      bgColor: "bg-green-500/10"
    },
    { 
      id: "device_health", 
      title: "Device Health Report", 
      desc: "Status and uptime of all connected devices.",
      icon: <Smartphone className="h-4 w-4" />,
      formats: ["pdf", "excel"],
      color: "text-orange-500",
      bgColor: "bg-orange-500/10"
    },
    { 
      id: "account_activity", 
      title: "Account Activity Report", 
      desc: "Admin and logins of all Account Activities.",
      icon: <UserCheck className="h-4 w-4" />,
      formats: ["pdf", "excel", "csv"],
      color: "text-red-500",
      bgColor: "bg-red-500/10"
    }
  ];

  const organizationType = (admin as any)?.organizationType || (admin as any)?.org_type || "school";
  const userLabel = organizationType === "school" ? "Student Name Or Stuff" : "Employee Name";
  const organizationName = (admin as any)?.organizationName || (admin as any)?.org_name || "Organization";

  // Check data availability when config changes
  useEffect(() => {
    if (admin?.organizationId) {
      checkDataAvailability();
    }
  }, [admin, reportConfig.type, reportConfig.timeRange, reportConfig.dateRange, reportConfig.searchTerm]);

  const getDateRangeFromTimeRange = (timeRange: string, customStart?: Date, customEnd?: Date) => {
    const now = new Date();
    let start = new Date();
    let end = new Date();

    switch (timeRange) {
      case "daily":
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case "weekly":
        const weekStart = now.getDate() - now.getDay();
        start = new Date(now.getFullYear(), now.getMonth(), weekStart);
        end = new Date(now.getFullYear(), now.getMonth(), weekStart + 6);
        break;
      case "monthly":
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case "yearly":
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now.getFullYear(), 11, 31);
        break;
      case "custom":
        start = customStart || now;
        end = customEnd || now;
        break;
    }
    
    return { start, end };
  };

  const updateDateRange = (timeRange: string, customStart?: Date, customEnd?: Date) => {
    const { start, end } = getDateRangeFromTimeRange(timeRange, customStart, customEnd);
    setReportConfig(prev => ({
      ...prev,
      timeRange: timeRange as any,
      dateRange: { start, end }
    }));
  };

  const handleCustomDateChange = (start: Date, end: Date) => {
    setReportConfig(prev => ({
      ...prev,
      timeRange: "custom",
      dateRange: { start, end }
    }));
  };

  const checkDataAvailability = async () => {
    try {
      const params: any = {
        org_id: admin?.organizationId,
        format: "json",
        limit: 1
      };
      
      if (reportConfig.dateRange.start && reportConfig.dateRange.end) {
        params.start_date = format(reportConfig.dateRange.start, 'yyyy-MM-dd');
        params.end_date = format(reportConfig.dateRange.end, 'yyyy-MM-dd');
      }
      
      if (reportConfig.type === 'monthly_analytics') {
        params.month = format(reportConfig.dateRange.start, 'MM');
        params.year = format(reportConfig.dateRange.start, 'yyyy');
      }
      
      if (reportConfig.type === 'user_activity' && reportConfig.searchTerm) {
        params.search = reportConfig.searchTerm;
      }
      
      const response = await api.get(`/reports/${reportConfig.type}`, { params });
      
      let hasData = false;
      let recordCount = 0;
      
      if (response.success && response.data) {
        if (response.data.records) {
          recordCount = response.data.records.length;
          hasData = recordCount > 0;
        } else if (response.data.user_activities) {
          recordCount = response.data.user_activities.length;
          hasData = recordCount > 0;
        } else if (response.data.devices) {
          recordCount = response.data.devices.length;
          hasData = recordCount > 0;
        } else if (response.data.summary) {
          hasData = true;
          recordCount = response.data.summary.total_records || 1;
        }
      }
      
      setReportStats(prev => ({
        ...prev,
        [reportConfig.type]: { hasData, recordCount }
      }));
    } catch (error) {
      console.error("Error checking data availability:", error);
      setReportStats(prev => ({
        ...prev,
        [reportConfig.type]: { hasData: false, recordCount: 0 }
      }));
    }
  };

  const downloadReport = async (reportType: string) => {
    if (!admin?.organizationId) {
      toast.error("Organization not found");
      return;
    }

    const stats = reportStats[reportType];
    if (!stats?.hasData) {
      toast.warning(`No data available for the selected period`);
      return;
    }

    setLoading(true);
    const toastId = toast.loading(`Generating ${reportType.replace(/_/g, ' ')}...`);
    
    try {
      const params: any = {
        org_id: admin.organizationId,
        format: reportConfig.format
      };
      
      if (reportConfig.dateRange.start && reportConfig.dateRange.end) {
        params.start_date = format(reportConfig.dateRange.start, 'yyyy-MM-dd');
        params.end_date = format(reportConfig.dateRange.end, 'yyyy-MM-dd');
      }
      
      if (reportType === 'user_activity' && reportConfig.searchTerm) {
        params.search = reportConfig.searchTerm;
      }
      
      if (reportType === 'monthly_analytics') {
        params.month = format(reportConfig.dateRange.start, 'MM');
        params.year = format(reportConfig.dateRange.start, 'yyyy');
      }

      const response = await api.get(`/reports/${reportType}`, { params });
      
      if (response.success && response.data) {
        let filename = `${reportType}_${format(new Date(), 'yyyy-MM-dd')}.${reportConfig.format}`;
        let content: string | Blob;
        let contentType = 'application/octet-stream';
        
        if (reportConfig.format === 'json') {
          content = JSON.stringify(response.data, null, 2);
          contentType = 'application/json';
        } else if (reportConfig.format === 'csv') {
          content = convertToCSV(response.data);
          contentType = 'text/csv';
        } else {
          content = JSON.stringify(response.data, null, 2);
          contentType = 'application/json';
        }
        
        const blob = new Blob([content], { type: contentType });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        toast.success("Report downloaded successfully", { id: toastId });
      } else {
        throw new Error(response.error || "Failed to generate report");
      }
    } catch (error) {
      console.error('Error downloading report:', error);
      toast.error("Failed to download report", { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const convertToCSV = (data: any): string => {
    let records = data.records || data.user_activities || data.devices || [];
    if (records.length === 0) return "No data available";
    
    const headers = Object.keys(records[0]);
    const csvRows = [headers.join(',')];
    
    for (const record of records) {
      const values = headers.map(header => {
        let value = record[header];
        if (value === null || value === undefined) return '';
        if (value instanceof Date) return format(value, 'yyyy-MM-dd HH:mm:ss');
        if (typeof value === 'object') return JSON.stringify(value).replace(/,/g, ';');
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      });
      csvRows.push(values.join(','));
    }
    
    return csvRows.join('\n');
  };

  const viewAsPDF = async (reportType: string) => {
    if (!admin?.organizationId) return;
    
    const stats = reportStats[reportType];
    if (!stats?.hasData) {
      toast.warning(`No data available for preview`);
      return;
    }
    
    setLoading(true);
    try {
      const params: any = {
        org_id: admin.organizationId,
        format: "json"
      };
      
      if (reportConfig.dateRange.start && reportConfig.dateRange.end) {
        params.start_date = format(reportConfig.dateRange.start, 'yyyy-MM-dd');
        params.end_date = format(reportConfig.dateRange.end, 'yyyy-MM-dd');
      }
      
      if (reportType === 'user_activity' && reportConfig.searchTerm) {
        params.search = reportConfig.searchTerm;
      }
      
      if (reportType === 'monthly_analytics') {
        params.month = format(reportConfig.dateRange.start, 'MM');
        params.year = format(reportConfig.dateRange.start, 'yyyy');
      }
      
      const response = await api.get(`/reports/${reportType}`, { params });
      
      if (response.success && response.data) {
        setPreviewData(response.data);
        setShowPDFViewer(true);
      } else {
        throw new Error(response.error || "Failed to generate PDF preview");
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error("Failed to generate PDF preview");
    } finally {
      setLoading(false);
    }
  };

  const getReportTitle = (reportType: string): string => {
    const report = reportTypes.find(r => r.id === reportType);
    return report?.title || "Report";
  };

  const getDataAvailabilityBadge = (reportId: string) => {
    const stats = reportStats[reportId];
    if (stats?.hasData) {
      return (
        <Badge variant="secondary" className="bg-muted text-muted-foreground text-xs">
          {stats.recordCount} records
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="bg-muted/50 text-muted-foreground/50 text-xs">
        No Data
      </Badge>
    );
  };

  const currentStats = reportStats[reportConfig.type];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* PDF Viewer Modal */}
      <PDFViewer
        isOpen={showPDFViewer}
        onClose={() => setShowPDFViewer(false)}
        reportData={previewData}
        reportTitle={getReportTitle(reportConfig.type)}
        reportType={reportConfig.type}
        organizationName={organizationName}
        dateRange={reportConfig.dateRange}
      />

      {/* Header */}
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
          <FileText className="h-6 w-6 text-primary" /> Reports
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Download and schedule automated reports.</p>
      </div>

      {/* Report Configuration Card */}
      <Card>
        <CardHeader>
          <CardTitle>Report Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Time Range Selection */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {["daily", "weekly", "monthly", "yearly", "custom"].map((range) => (
              <Button
                key={range}
                variant={reportConfig.timeRange === range ? "default" : "outline"}
                className={cn(
                  "capitalize",
                  reportConfig.timeRange === range && "gradient-primary text-primary-foreground"
                )}
                onClick={() => updateDateRange(range)}
              >
                {range}
              </Button>
            ))}
          </div>

          {/* Date Range Pickers */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Start Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !reportConfig.dateRange.start && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {reportConfig.dateRange.start ? format(reportConfig.dateRange.start, "PPP") : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={reportConfig.dateRange.start}
                    onSelect={(date) => {
                      if (date) {
                        handleCustomDateChange(date, reportConfig.dateRange.end);
                      }
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>End Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !reportConfig.dateRange.end && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {reportConfig.dateRange.end ? format(reportConfig.dateRange.end, "PPP") : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={reportConfig.dateRange.end}
                    onSelect={(date) => {
                      if (date) {
                        handleCustomDateChange(reportConfig.dateRange.start, date);
                      }
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          
          {/* Format Selection - PDF Default */}
          <div>
            <Label>Report Format</Label>
            <Select 
              value={reportConfig.format} 
              onValueChange={(value: any) => setReportConfig({ ...reportConfig, format: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select format" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pdf"><i className="bx bxs-file-pdf" style={{ fontSize: '16px' }}/> PDF (Default)</SelectItem>
                <SelectItem value="csv">CSV</SelectItem>
                <SelectItem value="excel">Excel</SelectItem>
                <SelectItem value="json">JSON</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Search by User Name - Only for user_activity report */}
          {reportConfig.type === "user_activity" && (
            <div>
              <Label>Search by {userLabel}</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder={`Enter ${userLabel.toLowerCase()} name...`}
                  value={searchValue}
                  onChange={(e) => {
                    setSearchValue(e.target.value);
                    setReportConfig({ ...reportConfig, searchTerm: e.target.value });
                  }}
                  className="pl-9"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Search by first name, last name, or email
              </p>
            </div>
          )}

          {/* Data Availability Indicator */}
          {currentStats && (
            <div className="p-3 bg-muted/30 rounded-lg flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Data Status</p>
                <p className="text-sm font-medium">
                  {currentStats.hasData 
                    ? `${currentStats.recordCount} records available` 
                    : "No data available for selected period"}
                </p>
              </div>
              <div className={cn(
                "w-2 h-2 rounded-full",
                currentStats.hasData ? "bg-green-500" : "bg-muted-foreground"
              )} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Report Types - Original Card Design */}
      <Tabs value={reportConfig.type} onValueChange={(value) => setReportConfig({ ...reportConfig, type: value })}>
       <TabsList className="grid w-full grid-cols-2 lg:grid-cols-5 gap-2">
  {reportTypes.map((report) => (
    <TabsTrigger key={report.id} value={report.id} className="flex items-center gap-2">
      {report.icon}
      <span>{report.title.split(' ')[0]}</span>
    </TabsTrigger>
  ))}
</TabsList>
        
        {reportTypes.map((report) => (
          <TabsContent key={report.id} value={report.id} className="mt-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-heading font-semibold text-foreground text-lg">{report.title}</h3>
                      {getDataAvailabilityBadge(report.id)}
                    </div>
                    <p className="text-sm text-muted-foreground">{report.desc}</p>
                    {reportConfig.type === "user_activity" && reportConfig.searchTerm && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Filtered by: {reportConfig.searchTerm}
                      </p>
                    )}
                    {reportConfig.timeRange !== "custom" && (
                      <p className="text-xs text-muted-foreground mt-1 capitalize">
                        Period: {reportConfig.timeRange} ({format(reportConfig.dateRange.start, 'MMM dd')} - {format(reportConfig.dateRange.end, 'MMM dd, yyyy')})
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => viewAsPDF(report.id)}
                      disabled={loading || !reportStats[report.id]?.hasData}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View as PDF
                    </Button>
                    <Button 
                      variant="default" 
                      size="sm"
                      onClick={() => downloadReport(report.id)}
                      disabled={loading || !reportStats[report.id]?.hasData}
                    >
                      {loading ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4 mr-2" />
                      )}
                      Download {reportConfig.format.toUpperCase()}
                    </Button>
                  </div>
                </div>
                
                {/* Available formats badge */}
                <div className="flex gap-2">
                  {report.formats.map((format) => (
                    <Badge key={format} variant={reportConfig.format === format ? "default" : "secondary"}>
                      {format.toUpperCase()}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default Reports;
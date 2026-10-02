// csms-frontend/src/components/PaymentProtectedRoute.tsx
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";

export const PaymentProtectedRoute = ({ children }: { children?: React.ReactNode }) => {
  const { admin, isLoading } = useAuth();
  const location = useLocation();
  const [needsPayment, setNeedsPayment] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkPaymentStatus = async () => {
      if (!admin || isLoading) {
        setChecking(false);
        return;
      }

      // First check localStorage for quick status
      const paymentCompleted = localStorage.getItem('payment_completed') === 'true';
      const needsPaymentFlag = localStorage.getItem('needs_payment') === 'true';
      const selectedPlan = localStorage.getItem('selected_plan_name');

      if (paymentCompleted) {
        setNeedsPayment(false);
        setChecking(false);
        return;
      }

      if (needsPaymentFlag && selectedPlan && selectedPlan !== 'free_trial') {
        setNeedsPayment(true);
        setChecking(false);
        return;
      }

      // If no localStorage flags, check with backend
      try {
        const token = localStorage.getItem("csm_token");
        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/subscription/status/${admin.organizationId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data) {
            const needsPaymentStatus = data.data.payment_status === 'pending' && 
                                       data.data.plan_selected !== 'free_trial' &&
                                       data.data.plan_selected !== null;
            setNeedsPayment(needsPaymentStatus);

            console.log('PaymentProtectedRoute - needsPayment:', needsPayment);
            console.log('PaymentProtectedRoute - admin:', admin);
            console.log('PaymentProtectedRoute - location:', location.pathname);
            
            if (needsPaymentStatus) {
              localStorage.setItem('needs_payment', 'true');
            } else if (data.data.payment_status === 'completed') {
              localStorage.setItem('payment_completed', 'true');
              localStorage.removeItem('needs_payment');
            }
          }
        }
      } catch (error) {
        console.error("Failed to check payment status:", error);
      } finally {
        setChecking(false);
      }
    };

    checkPaymentStatus();
  }, [admin, isLoading]);

  if (isLoading || checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Block dashboard access if payment needed and not on payment page
  if (needsPayment && location.pathname !== '/payment-required') {
    return <Navigate to="/payment-required" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
};

export default PaymentProtectedRoute;
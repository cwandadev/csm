// File: csms-frontend/src/components/TestingModePopup.tsx
import { useState, useEffect } from "react";

export const TestingModePopup = () => {
  const [show, setShow] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShow(false), 6000);
    return () => clearTimeout(timer);
  }, []);

  if (!show) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      // backdropFilter: 'blur(1px)'
    }}>
      <div className="testing-popup" style={{
        backgroundColor: 'hsl(0, 0%, 100%)',
        padding: '28px',
        borderRadius: '12px',
        maxWidth: '420px',
        width: '90%',
        textAlign: 'center',
        border: '2px solid bg-primary',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        animation: 'slideIn 0.3s ease-out'
      }}>
        {/* Boxicon Icon */}
        <div style={{ marginBottom: '16px' }}>
          <i className='bx bxs-credit-card' style={{ fontSize: '56px', color: 'tomato' }}></i>
        </div>
        
        <h3 style={{ 
          color: 'tomato', 
          marginBottom: '12px',
          fontSize: '22px',
          fontWeight: 'bold'
        }}>
          🧪 TESTING MODE
        </h3>
        
        <div style={{
          backgroundColor: 'wheat',
          padding: '10px',
          borderRadius: '8px',
          marginBottom: '16px'
        }}>
          <span style={{
            color: 'tomato',
            fontSize: '14px',
            fontWeight: 'bold',
            margin: 0
          }}>
            <i className='bx bx-error-circle' style={{ marginRight: '6px' }}></i>
            Manual Payment Required
          </span>
        </div>
        
        <p style={{
          color: '#000f00',
          fontSize: '13px',
          lineHeight: '1.6',
          marginBottom: '20px'
        }}>
          This application is in testing mode. While the payment system appears functional,
          <strong style={{ color: 'tomato' }}> no automatic charges will be processed</strong>.
          Please contact our team to complete your subscription manually.
        </p>
        
        <button 
          onClick={() => setShow(false)}
          style={{
            padding: '10px 24px',
            backgroundColor: 'hsl(212, 100%, 50%)',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'bold',
            transition: 'all 0.2s ease',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'hsl(212, 100%, 45%)';
            e.currentTarget.style.transform = 'scale(1.05)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'hsl(212, 100%, 50%)';
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          <i className='bx bx-check-double'></i>
          Understood
        </button>
        
        <p style={{ 
          fontSize: '11px', 
          marginTop: '16px', 
          color: 'hsl(213, 1%, 49%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px'
        }}>
          <i className='bx bx-timer'></i>
          Auto-closing in 5 seconds
        </p>
      </div>
      
      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-30px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        
        /* Dark mode support */
        .dark .testing-popup {
          background-color: hsl(0, 0%, 16%) !important;
        }
        
        .dark .testing-popup p:first-of-type {
          color: hsl(224, 59%, 93%) !important;
        }
      `}</style>
    </div>
  );
};
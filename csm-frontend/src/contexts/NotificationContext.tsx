// csms-frontend/src/contexts/NotificationContext.tsx
import React, { createContext, useContext, useState, useCallback } from 'react';
import { AlertCircle, UserPlus, X, Bell, Fingerprint } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

interface UnregisteredCardNotification {
  id: string;
  cardId: string;
  deviceId?: string;
  timestamp: Date;
}

interface NotificationContextType {
  showUnregisteredCardPopup: (cardId: string, deviceId?: string) => void;
  hidePopup: (id: string) => void;
  activeNotifications: UnregisteredCardNotification[];
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within NotificationProvider');
  }
  return context;
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeNotifications, setActiveNotifications] = useState<UnregisteredCardNotification[]>([]);
  const [notifiedCards, setNotifiedCards] = useState<Map<string, number>>(new Map());
  const navigate = useNavigate();

  const showUnregisteredCardPopup = useCallback((cardId: string, deviceId?: string) => {
    const now = Date.now();
    const lastNotified = notifiedCards.get(cardId);
    
    // Only show notification if card hasn't been notified in the last 30 seconds
    if (lastNotified && (now - lastNotified) < 30000) {
      console.log(`[Notification] Card ${cardId} already notified recently, skipping`);
      return;
    }
    
    const id = `${cardId}-${now}`;
    const newNotification: UnregisteredCardNotification = {
      id,
      cardId,
      deviceId,
      timestamp: new Date(),
    };
    
    // Mark this card as notified
    setNotifiedCards(prev => new Map(prev).set(cardId, now));
    
    setActiveNotifications(prev => [...prev, newNotification]);
    
    // Auto-hide after 30 seconds
    setTimeout(() => {
      setActiveNotifications(prev => prev.filter(n => n.id !== id));
    }, 30000);
  }, [notifiedCards]);

  const hidePopup = useCallback((id: string) => {
    setActiveNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const handleProceed = (cardId: string) => {
    // Store the card ID in sessionStorage to pre-fill the add user form
    sessionStorage.setItem('pendingCardUid', cardId);
    sessionStorage.setItem('pendingCardTimestamp', new Date().toISOString());
    
    // Navigate to users management with add modal flag
    navigate('/dashboard/users?view=list&openAddModal=true');
    
    // Close all notifications
    setActiveNotifications([]);
  };

  return (
    <NotificationContext.Provider value={{ showUnregisteredCardPopup, hidePopup, activeNotifications }}>
      {children}
      
      {/* Global Notification Popups - Matching your dashboard design */}
      <div className="fixed bottom-4 right-4 z-50 space-y-3">
        {activeNotifications.map((notification) => (
          <div
            key={notification.id}
            className="bg-card border border-border rounded-xl shadow-lg w-96 animate-slide-in overflow-hidden"
          >
            {/* Header with gradient - matching your design */}
            <div className="gradient-primary px-4 py-3">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-primary-foreground" />
                <span className="text-primary-foreground text-sm font-medium">New Card Detected</span>
              </div>
            </div>
            
            {/* Content */}
            <div className="p-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center">
                    <Fingerprint className="h-5 w-5 text-orange-500" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    Unregistered Card Scanned
                  </p>
                  <div className="mt-1 p-2 bg-muted/30 rounded-md">
                    <code className="text-xs font-mono text-foreground break-all">
                      {notification.cardId}
                    </code>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    This card is not registered in the system. Would you like to register a new user with this card?
                  </p>
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      className="gradient-primary text-primary-foreground hover:shadow-md transition-all flex-1"
                      onClick={() => handleProceed(notification.cardId)}
                    >
                      <UserPlus className="h-3 w-3 mr-1" />
                      Register User
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => hidePopup(notification.id)}
                      className="flex-1"
                    >
                      Dismiss
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slide-in {
          animation: slideIn 0.3s ease-out;
        }
      `}</style>
    </NotificationContext.Provider>
  );
};
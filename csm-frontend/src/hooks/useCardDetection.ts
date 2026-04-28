// csms-frontend/src/hooks/useCardDetection.ts
import { useEffect, useRef } from 'react';
import { useNotification } from '@/contexts/NotificationContext';
import api from '@/lib/api';

export const useCardDetection = (enabled: boolean = true) => {
  const { showUnregisteredCardPopup } = useNotification();
  const processedScansRef = useRef<Set<number>>(new Set()); // Store scan IDs

  useEffect(() => {
    if (!enabled) return;

    let isMounted = true;

    const fetchUnregisteredScans = async () => {
      try {
        const response = await api.get('/recent-unregistered-scans');
        
        if (response.success && response.data && Array.isArray(response.data) && isMounted) {
          for (const scan of response.data) {
            // Use database ID to prevent duplicate processing
            if (!processedScansRef.current.has(scan.id)) {
              processedScansRef.current.add(scan.id);
              
              // Still check card cooldown in the popup function
              showUnregisteredCardPopup(scan.card_id, scan.device_id);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching unregistered scans:', error);
      }
    };

    // Poll every 5 seconds
    const interval = setInterval(fetchUnregisteredScans, 5000);
    
    // Initial fetch
    fetchUnregisteredScans();

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [enabled, showUnregisteredCardPopup]);
};
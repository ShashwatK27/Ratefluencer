import React, { createContext, useContext, useState, useCallback } from 'react';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [campaignMeta, setCampaignMeta] = useState(null);
  const [recos, setRecos] = useState([]);
  const [insights, setInsights] = useState([]);
  const [lastFormData, setLastFormData] = useState(null);
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((msg) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, msg }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 2500);
  }, []);

  return (
    <AppContext.Provider value={{
      campaignMeta, setCampaignMeta,
      recos, setRecos,
      insights, setInsights,
      lastFormData, setLastFormData,
      toasts, showToast,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}

import { useState, useEffect } from 'react';

type Lang = 'en' | 'es';

export const dictionaries = {
  en: {
    dashboard: "Dashboard",
    menu: "Menu",
    messages: "@Messages",
    dm: "Direct Message",
    orgThread: "Organization's Thread",
    submitTicket: "Submit a Ticket",
    reports: "Reports",
    flagshipTools: "Flagship Tools",
    crm: "CRM (Customer Relationship Manager)",
    drive: "DRiVE (Proprietary Learning Management System)",
    bi: "BI (Business Intelligence)",
    erp: "ERP (Enterprise Resource Planning)",
    socialMediaIntegrations: "Social Media",
    googleIntegrations: "Google Integrations",
    googleCalendar: "Google Calendar",
    googleDocs: "Google Docs",
    googleSlides: "Google Slides",
    googleSheets: "Google Sheets",
    exitDashboard: "Exit Dashboard",
    searchPlaceholder: "Search here...",
    
    // SolTheory Dashboard Home
    masterControl: "Master Control",
    solTheoryHub: "SOL Theory",
    solTheoryHubDesc: "Global administrative nervous system. Monitor cross-organization analytics, AI agent health, and internal communications.",
    activeOrganizations: "Active Organizations",
    boundToLiveDB: "Bound to live DB",
    targetClients: "Target Clients",
    verifiedAccounts: "Verified Accounts",
    agentManager: "Agent Manager",
    manageActiveProtocols: "Manage active AI protocols",
    platformTrafficAnalytics: "Platform Traffic Analytics",
    awaitingData: "Awaiting data",
    liveTracking: "Live active tracking streaming from database.",
    today: "Today",
    establishingDBConnection: "Establishing Database Connection...",

    // NXTChapter Dashboard Home
    nxtChapterHub: "NXT Chapter Hub",
    nxtChapterHubDesc: "Global administrative nervous system. Monitor cross-organization analytics, AI agent health, and internal communications."
  },
  es: {
    dashboard: "Panel",
    menu: "Menú",
    messages: "@Mensajes",
    dm: "Mensaje Directo",
    orgThread: "Hilo de la Organización",
    submitTicket: "Enviar un Ticket",
    reports: "Reportes",
    flagshipTools: "Herramientas Insignia",
    crm: "CRM (Gestor de Relaciones con el Cliente)",
    drive: "DRiVE (Sistema de Gestión de Aprendizaje Propietario)",
    bi: "BI (Inteligencia de Negocios)",
    erp: "ERP (Planificación de Recursos Empresariales)",
    socialMediaIntegrations: "Redes Sociales",
    googleIntegrations: "Integraciones de Google",
    googleCalendar: "Google Calendar",
    googleDocs: "Documentos de Google",
    googleSlides: "Presentaciones de Google",
    googleSheets: "Hojas de Cálculo de Google",
    exitDashboard: "Salir del Panel",
    searchPlaceholder: "Buscar aquí...",

    // SolTheory Dashboard Home
    masterControl: "Control Maestro",
    solTheoryHub: "SOL Theory", // Required to not translate Sol Theory
    solTheoryHubDesc: "Sistema nervioso administrativo global. Monitorear analíticas inter-organizacionales, la salud de los agentes de IA y las comunicaciones internas.",
    activeOrganizations: "Organizaciones Activas",
    boundToLiveDB: "Conectado a la BD en vivo",
    targetClients: "Clientes Objetivo",
    verifiedAccounts: "Cuentas Verificadas",
    agentManager: "Gestor de Agentes",
    manageActiveProtocols: "Gestionar protocolos de IA activos",
    platformTrafficAnalytics: "Analítica del Tráfico de la Plataforma",
    awaitingData: "Esperando datos",
    liveTracking: "Transmisión en vivo de seguimiento activo desde la base de datos.",
    today: "Hoy",
    establishingDBConnection: "Estableciendo conexión con la base de datos...",

    // NXTChapter Dashboard Home
    nxtChapterHub: "NXT Chapter",
    nxtChapterHubDesc: "Sistema nervioso administrativo global. Monitorear analíticas inter-organizacionales, la salud de los agentes de IA y las comunicaciones internas."
  }
};

export function useTranslation() {
  const [lang, setLang] = useState<Lang>('en');

  useEffect(() => {
    const handleStorageChange = () => {
      const savedLang = localStorage.getItem('agent_language') as Lang;
      if (savedLang === 'en' || savedLang === 'es') {
        setLang(savedLang);
      }
    };
    
    // Initial fetch
    handleStorageChange();

    // Listen to changes (if made in settings on another tab or same window)
    window.addEventListener('storage', handleStorageChange);
    
    // Create an override poller or custom event for same-window updates if needed,
    // but usually setting it in local state works fine if navigating forces re-mount.
    const interval = setInterval(handleStorageChange, 1000);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  return { t: dictionaries[lang], lang };
}

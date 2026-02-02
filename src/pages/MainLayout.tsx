import { useState } from 'react';
import { AppData } from '../types';
import { Sidebar } from '../components/Sidebar';
import { SitesList } from './SitesList';
import { SiteDetail } from './SiteDetail';
import './MainLayout.css';

interface MainLayoutProps {
  appData: AppData;
  onDataChange: (data: AppData) => void;
  onLock: () => void;
}

export type ViewMode = 'all' | 'up-to-date' | 'action-required' | 'in-progress';

export const MainLayout: React.FC<MainLayoutProps> = ({
  appData,
  onDataChange,
  onLock,
}) => {
  const [currentView, setCurrentView] = useState<ViewMode>('all');
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Handler pour changer de vue et fermer automatiquement le détail
  const handleViewChange = (view: ViewMode) => {
    setCurrentView(view);
    setSelectedSiteId(null); // Fermer le détail automatiquement
  };

  // Filtrer les sites selon la vue actuelle
  const filteredSites = appData.sites.filter((site) => {
    // Filtre par recherche
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (!site.name.toLowerCase().includes(query)) {
        return false;
      }
    }

    // Filtre par vue
    if (currentView === 'up-to-date') {
      // Sites à jour : toutes les tâches de la checklist sont faites
      return site.enabled && site.checklist.every((item) => item.done);
    }
    if (currentView === 'action-required') {
      // Sites nécessitant une action : au moins une tâche non faite
      return site.enabled && site.checklist.some((item) => !item.done);
    }
    if (currentView === 'in-progress') {
      // Sites en cours : interventions récentes (moins de 7 jours)
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return (
        site.enabled &&
        site.interventions.length > 0 &&
        new Date(site.interventions[0].date) > weekAgo
      );
    }

    // Vue 'all' : tous les sites actifs
    return site.enabled;
  });

  const selectedSite = selectedSiteId
    ? appData.sites.find((s) => s.id === selectedSiteId)
    : null;

  const handleSiteClick = (siteId: string) => {
    setSelectedSiteId(siteId);
  };

  const handleBackToList = () => {
    setSelectedSiteId(null);
  };

  return (
    <div className="main-layout">
      <Sidebar
        sites={appData.sites}
        currentView={currentView}
        onViewChange={handleViewChange}
        onLock={onLock}
      />

      <main className="main-content">
        {selectedSite ? (
          <SiteDetail
            site={selectedSite}
            onBack={handleBackToList}
            onUpdate={(updatedSite) => {
              const updatedData = {
                ...appData,
                sites: appData.sites.map((s) =>
                  s.id === updatedSite.id ? updatedSite : s
                ),
              };
              onDataChange(updatedData);
            }}
          />
        ) : (
          <SitesList
            sites={filteredSites}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onSiteClick={handleSiteClick}
            currentView={currentView}
          />
        )}
      </main>
    </div>
  );
};

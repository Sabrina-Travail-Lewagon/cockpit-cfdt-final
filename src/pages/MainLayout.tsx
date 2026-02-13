import { useState } from 'react';
import { AppData, Site } from '../types';
import { Sidebar } from '../components/Sidebar';
import { SitesList } from './SitesList';
import { SiteDetail } from './SiteDetail';
import { Settings } from './Settings';
import { AddSiteModal } from '../components/AddSiteModal';
import './MainLayout.css';

interface MainLayoutProps {
  appData: AppData;
  onDataChange: (data: AppData) => void;
  onLock: () => void;
  onPasswordChanged: (newPassword: string) => void;
  password: string;
}

export type ViewMode = 'all' | 'up-to-date' | 'action-required' | 'in-progress';

export const MainLayout: React.FC<MainLayoutProps> = ({
  appData,
  onDataChange,
  onLock,
  onPasswordChanged,
  password,
}) => {
  const [currentView, setCurrentView] = useState<ViewMode>('all');
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Mot de passe Enpass separe (session uniquement, non persiste)
  const [enpassSeparatePassword, setEnpassSeparatePassword] = useState('');

  // Mot de passe effectif pour Enpass : utilise le mdp separe si configure, sinon le mdp Cockpit
  const effectiveEnpassPassword = appData.settings.enpass_use_separate_password && enpassSeparatePassword
    ? enpassSeparatePassword
    : password;

  // Handler pour changer de vue et fermer automatiquement le détail
  const handleViewChange = (view: ViewMode) => {
    setCurrentView(view);
    setSelectedSiteId(null); // Fermer le détail automatiquement
    setShowSettings(false); // Fermer les paramètres
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

  const handleAddSite = (newSite: Site) => {
    const updatedData = {
      ...appData,
      sites: [...appData.sites, newSite],
    };
    onDataChange(updatedData);
    setShowAddModal(false);
  };

  const handleDeleteSite = (siteId: string) => {
    const updatedData = {
      ...appData,
      sites: appData.sites.filter((s) => s.id !== siteId),
    };
    onDataChange(updatedData);
    setSelectedSiteId(null); // Retourner à la liste
  };

  const handleImportSites = (importedSites: Site[]) => {
    // Fusionner les sites importés avec les existants
    // Les sites avec le même ID sont mis à jour, les nouveaux sont ajoutés
    const existingSiteIds = new Set(appData.sites.map(s => s.id));
    const sitesToUpdate: Site[] = [];
    const sitesToAdd: Site[] = [];

    importedSites.forEach(site => {
      if (existingSiteIds.has(site.id)) {
        sitesToUpdate.push(site);
      } else {
        sitesToAdd.push(site);
      }
    });

    const updatedSites = appData.sites.map(existing => {
      const updated = sitesToUpdate.find(s => s.id === existing.id);
      return updated || existing;
    });

    const updatedData = {
      ...appData,
      sites: [...updatedSites, ...sitesToAdd],
    };
    onDataChange(updatedData);
  };

  return (
    <div className="main-layout">
      <Sidebar
        sites={appData.sites}
        currentView={currentView}
        onViewChange={handleViewChange}
        onLock={onLock}
        onSettings={() => {
          setShowSettings(true);
          setSelectedSiteId(null);
        }}
      />

      <main className="main-content">
        {showSettings ? (
          <Settings
            onBack={() => setShowSettings(false)}
            onPasswordChanged={onPasswordChanged}
            appData={appData}
            onDataChange={onDataChange}
            onImportSites={handleImportSites}
            password={password}
            enpassSeparatePassword={enpassSeparatePassword}
            onEnpassSeparatePasswordChange={setEnpassSeparatePassword}
          />
        ) : selectedSite ? (
          <SiteDetail
            site={selectedSite}
            settings={appData.settings}
            enpassMasterPassword={effectiveEnpassPassword}
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
            onDelete={handleDeleteSite}
          />
        ) : (
          <SitesList
            sites={filteredSites}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onSiteClick={handleSiteClick}
            onAddSite={() => setShowAddModal(true)}
            currentView={currentView}
          />
        )}
      </main>

      {showAddModal && (
        <AddSiteModal
          onAdd={handleAddSite}
          onClose={() => setShowAddModal(false)}
          settings={appData.settings}
          enpassMasterPassword={effectiveEnpassPassword}
        />
      )}
    </div>
  );
};

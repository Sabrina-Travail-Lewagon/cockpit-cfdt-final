import { Site } from '../types';
import { ViewMode } from './MainLayout';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { SiteCard } from '../components/SiteCard';
import './SitesList.css';

interface SitesListProps {
  sites: Site[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSiteClick: (siteId: string) => void;
  onAddSite: () => void;
  currentView: ViewMode;
}

export const SitesList: React.FC<SitesListProps> = ({
  sites,
  searchQuery,
  onSearchChange,
  onSiteClick,
  onAddSite,
  currentView,
}) => {
  const getViewTitle = () => {
    switch (currentView) {
      case 'all':
        return 'Tous les sites';
      case 'up-to-date':
        return 'Sites à jour';
      case 'action-required':
        return 'Action requise';
      case 'in-progress':
        return 'En cours';
      default:
        return 'Sites';
    }
  };

  const getViewDescription = () => {
    switch (currentView) {
      case 'all':
        return `${sites.length} site${sites.length > 1 ? 's' : ''} actif${sites.length > 1 ? 's' : ''}`;
      case 'up-to-date':
        return `${sites.length} site${sites.length > 1 ? 's' : ''} à jour`;
      case 'action-required':
        return `${sites.length} site${sites.length > 1 ? 's nécessitent' : ' nécessite'} une action`;
      case 'in-progress':
        return `${sites.length} site${sites.length > 1 ? 's' : ''} en cours de traitement`;
      default:
        return '';
    }
  };

  // Stats rapides
  const stats = {
    total: sites.length,
    upToDate: sites.filter((s) => s.checklist.every((item) => item.done)).length,
    actionRequired: sites.filter((s) => s.checklist.some((item) => !item.done)).length,
  };

  return (
    <div className="sites-list">
      <div className="sites-header">
        <div className="header-content">
          <h1>{getViewTitle()}</h1>
          <p>{getViewDescription()}</p>
        </div>
        <Button variant="primary" onClick={onAddSite}>
          + Ajouter un site
        </Button>
      </div>

      <div className="sites-search">
        <Input
          type="search"
          placeholder="Rechercher un site..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          icon="🔍"
        />
      </div>

      <div className="sites-stats">
        <div className="stat-card">
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">Total</div>
        </div>
        <div className="stat-card success">
          <div className="stat-value">{stats.upToDate}</div>
          <div className="stat-label">À jour</div>
        </div>
        <div className="stat-card warning">
          <div className="stat-value">{stats.actionRequired}</div>
          <div className="stat-label">Action requise</div>
        </div>
      </div>

      {sites.length === 0 ? (
        <div className="sites-empty">
          <div className="empty-icon">🔍</div>
          <h3>Aucun site trouvé</h3>
          <p>Essayez de modifier votre recherche ou vos filtres</p>
        </div>
      ) : (
        <div className="sites-grid">
          {sites.map((site) => (
            <SiteCard
              key={site.id}
              site={site}
              onClick={() => onSiteClick(site.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

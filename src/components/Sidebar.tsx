import { Site } from '../types';
import { ViewMode } from '../pages/MainLayout';
import './Sidebar.css';

interface SidebarProps {
  sites: Site[];
  currentView: ViewMode;
  onViewChange: (view: ViewMode) => void;
  onLock: () => void;
  onSettings: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  sites,
  currentView,
  onViewChange,
  onLock,
  onSettings,
}) => {
  const activeSites = sites.filter((s) => s.enabled);
  
  // Compter les sites par catégorie
  const upToDateCount = activeSites.filter((site) =>
    site.checklist.every((item) => item.done)
  ).length;

  const actionRequiredCount = activeSites.filter((site) =>
    site.checklist.some((item) => !item.done)
  ).length;

  const inProgressCount = activeSites.filter((site) => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return (
      site.interventions.length > 0 &&
      new Date(site.interventions[0].date) > weekAgo
    );
  }).length;

  // Compter les sites par serveur
  const serverCounts = activeSites.reduce((acc, site) => {
    const server = site.server.ovh_vps;
    acc[server] = (acc[server] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <span className="logo-icon">✈️</span>
          <div>
            <h2>Cockpit CFDT</h2>
            <p>Pilotez vos sites</p>
          </div>
        </div>

        <div className="sidebar-profile">
          <div className="profile-avatar">S</div>
          <div className="profile-info">
            <div className="profile-name">Sabrina</div>
            <div className="profile-role">Admin CFDT</div>
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section">
          <div className="nav-section-title">Sections</div>
          
          <button
            className={`nav-item ${currentView === 'all' ? 'active' : ''}`}
            onClick={() => onViewChange('all')}
          >
            <span className="nav-icon">📊</span>
            <span className="nav-label">Tous les sites</span>
            <span className="nav-badge">{activeSites.length}</span>
          </button>

          <button
            className={`nav-item ${currentView === 'up-to-date' ? 'active' : ''}`}
            onClick={() => onViewChange('up-to-date')}
          >
            <span className="nav-icon">✅</span>
            <span className="nav-label">À jour</span>
            <span className="nav-badge success">{upToDateCount}</span>
          </button>

          <button
            className={`nav-item ${currentView === 'action-required' ? 'active' : ''}`}
            onClick={() => onViewChange('action-required')}
          >
            <span className="nav-icon">⚠️</span>
            <span className="nav-label">Action requise</span>
            <span className="nav-badge warning">{actionRequiredCount}</span>
          </button>

          <button
            className={`nav-item ${currentView === 'in-progress' ? 'active' : ''}`}
            onClick={() => onViewChange('in-progress')}
          >
            <span className="nav-icon">🔄</span>
            <span className="nav-label">En cours</span>
            <span className="nav-badge info">{inProgressCount}</span>
          </button>
        </div>

        <div className="nav-section">
          <div className="nav-section-title">Serveurs</div>
          
          {Object.entries(serverCounts).map(([server, count]) => (
            <a
              key={server}
              href="https://www.ovh.com/manager/"
              target="_blank"
              rel="noopener noreferrer"
              className="nav-item-link"
            >
              <span className="nav-icon">🖥️</span>
              <span className="nav-label">{server}</span>
              <span className="nav-badge">{count}</span>
            </a>
          ))}
        </div>

        <div className="nav-section">
          <div className="nav-section-title">Outils</div>
          
          <button className="nav-item" disabled>
            <span className="nav-icon">📈</span>
            <span className="nav-label">Statistiques</span>
          </button>

          <button className="nav-item" disabled>
            <span className="nav-icon">📋</span>
            <span className="nav-label">Checklists</span>
          </button>

          <button className="nav-item" disabled>
            <span className="nav-icon">📝</span>
            <span className="nav-label">Journal</span>
          </button>
        </div>
      </nav>

      <div className="sidebar-footer">
        <button className="footer-button" onClick={onSettings}>
          <span>⚙️</span>
          <span>Paramètres</span>
        </button>

        <button className="footer-button lock-button" onClick={onLock}>
          <span>🔒</span>
          <span>Verrouiller</span>
        </button>
      </div>
    </aside>
  );
};

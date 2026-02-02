import { Site } from '../types';
import './SiteCard.css';

interface SiteCardProps {
  site: Site;
  onClick: () => void;
}

export const SiteCard: React.FC<SiteCardProps> = ({ site, onClick }) => {
  const completedTasks = site.checklist.filter((item) => item.done).length;
  const totalTasks = site.checklist.length;
  const isAllDone = totalTasks > 0 && completedTasks === totalTasks;

  const getStatusBadge = () => {
    if (isAllDone) {
      return <span className="status-badge success">✅ À jour</span>;
    }
    if (completedTasks > 0) {
      return <span className="status-badge warning">⚠️ Action requise</span>;
    }
    return <span className="status-badge info">🔄 En attente</span>;
  };

  return (
    <div className="site-card" onClick={onClick}>
      <div className="card-header">
        <h3 className="card-title">{site.name}</h3>
        {getStatusBadge()}
      </div>

      <div className="card-info">
        <div className="info-row">
          <span className="info-icon">🌐</span>
          <span className="info-text">{site.urls.frontend}</span>
        </div>
        
        <div className="info-row">
          <span className="info-icon">🖥️</span>
          <span className="info-text">{site.server.ovh_vps}</span>
        </div>

        <div className="info-row">
          <span className="info-icon">⚙️</span>
          <span className="info-text">
            Joomla {site.tech.joomla_version} • PHP {site.tech.php_version}
          </span>
        </div>
      </div>

      {totalTasks > 0 && (
        <div className="card-progress">
          <div className="progress-header">
            <span className="progress-label">Checklist</span>
            <span className="progress-value">
              {completedTasks}/{totalTasks}
            </span>
          </div>
          <div className="progress-bar">
            <div
              className={`progress-fill ${isAllDone ? 'complete' : ''}`}
              style={{ width: `${(completedTasks / totalTasks) * 100}%` }}
            />
          </div>
        </div>
      )}

      {site.interventions.length > 0 && (
        <div className="card-footer">
          <span className="footer-icon">🔧</span>
          <span className="footer-text">
            Dernière intervention : {new Date(site.interventions[0].date).toLocaleDateString('fr-FR')}
          </span>
        </div>
      )}
    </div>
  );
};

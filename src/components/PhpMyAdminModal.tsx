import { useState } from 'react';
import { Site } from '../types';
import { Button } from './Button';
import './PhpMyAdminModal.css';

interface PhpMyAdminModalProps {
  site: Site;
  onClose: () => void;
}

export const PhpMyAdminModal: React.FC<PhpMyAdminModalProps> = ({ site, onClose }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const steps = [
    {
      number: 1,
      title: 'Ouvrir phpMyAdmin',
      content: (
        <div>
          <p>Accédez à l'interface phpMyAdmin du site :</p>
          <div className="code-block">
            <code>{site.urls.phpmyadmin}</code>
            <button
              className="copy-button"
              onClick={() => copyToClipboard(site.urls.phpmyadmin, 'url')}
            >
              {copied === 'url' ? '✓ Copié' : '📋 Copier'}
            </button>
          </div>
          <a
            href={site.urls.phpmyadmin}
            target="_blank"
            rel="noopener noreferrer"
            className="open-link"
          >
            🔗 Ouvrir phpMyAdmin dans un nouvel onglet
          </a>
        </div>
      ),
    },
    {
      number: 2,
      title: 'Recuperer les credentials',
      content: (
        <div>
          <p>Recuperez les identifiants MySQL depuis Enpass :</p>
          <div className="credential-item">
            <div className="credential-label">Reference Enpass</div>
            <div className="code-block">
              <code>{site.enpass_refs.mysql_su}</code>
              <button
                className="copy-button"
                onClick={() => copyToClipboard(site.enpass_refs.mysql_su, 'enpass')}
              >
                {copied === 'enpass' ? '✓ Copie' : '📋 Copier'}
              </button>
            </div>
          </div>
          <div className="info-box">
            <strong>💡 Astuce :</strong> Utilisez les boutons 👤 et 🔑 sur la page du site pour copier automatiquement le login et le mot de passe depuis Enpass
          </div>
        </div>
      ),
    },
    {
      number: 3,
      title: 'Se connecter',
      content: (
        <div>
          <p>Remplissez le formulaire de connexion phpMyAdmin :</p>
          <div className="connection-info">
            <div className="connection-field">
              <span className="field-label">Serveur</span>
              <div className="code-block">
                <code>{site.server.mysql_host}</code>
                <button
                  className="copy-button"
                  onClick={() => copyToClipboard(site.server.mysql_host, 'host')}
                >
                  {copied === 'host' ? '✓ Copié' : '📋 Copier'}
                </button>
              </div>
            </div>
            <div className="connection-field">
              <span className="field-label">Base de données</span>
              <div className="code-block">
                <code>{site.server.database}</code>
                <button
                  className="copy-button"
                  onClick={() => copyToClipboard(site.server.database, 'db')}
                >
                  {copied === 'db' ? '✓ Copié' : '📋 Copier'}
                </button>
              </div>
            </div>
            <div className="connection-field">
              <span className="field-label">Utilisateur</span>
              <div className="info-text">Recupere depuis Enpass (etape 2)</div>
            </div>
            <div className="connection-field">
              <span className="field-label">Mot de passe</span>
              <div className="info-text">Recupere depuis Enpass (etape 2)</div>
            </div>
          </div>
          <div className="success-box">
            <strong>✅ Connecté !</strong> Vous pouvez maintenant gérer la base de données
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>🔧 Assistant connexion phpMyAdmin</h2>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="progress-bar-container">
            <div className="progress-steps">
              {steps.map((step) => (
                <div
                  key={step.number}
                  className={`progress-step ${currentStep >= step.number ? 'active' : ''} ${
                    currentStep === step.number ? 'current' : ''
                  }`}
                >
                  <div className="step-number">{step.number}</div>
                  <div className="step-label">{step.title}</div>
                </div>
              ))}
            </div>
            <div className="progress-line">
              <div
                className="progress-fill-line"
                style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
              />
            </div>
          </div>

          <div className="step-content">
            <h3>Étape {currentStep} : {steps[currentStep - 1].title}</h3>
            {steps[currentStep - 1].content}
          </div>
        </div>

        <div className="modal-footer">
          <Button
            variant="ghost"
            onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
            disabled={currentStep === 1}
          >
            ← Précédent
          </Button>
          
          {currentStep < steps.length ? (
            <Button
              variant="primary"
              onClick={() => setCurrentStep(Math.min(steps.length, currentStep + 1))}
            >
              Suivant →
            </Button>
          ) : (
            <Button variant="primary" onClick={onClose}>
              ✓ Terminer
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

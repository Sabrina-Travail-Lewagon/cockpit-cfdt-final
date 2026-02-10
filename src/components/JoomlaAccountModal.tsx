import { useState, useEffect } from 'react';
import { JoomlaAccount } from '../types';
import { Button } from './Button';
import './JoomlaAccountModal.css';

interface JoomlaAccountModalProps {
  account: JoomlaAccount | null;
  onSave: (account: JoomlaAccount) => void;
  onDelete?: () => void;
  onClose: () => void;
}

const ROLE_OPTIONS = [
  'Super Administrateur',
  'Administrateur',
  'Manager',
  'Éditeur',
  'Auteur',
  'Rédacteur',
  'Contributeur',
  'Utilisateur enregistré',
  'Autre',
];

export const JoomlaAccountModal: React.FC<JoomlaAccountModalProps> = ({
  account,
  onSave,
  onDelete,
  onClose,
}) => {
  const [username, setUsername] = useState('');
  const [role, setRole] = useState('Éditeur');
  const [dashlaneRef, setDashlaneRef] = useState('');

  useEffect(() => {
    if (account) {
      setUsername(account.username);
      setRole(account.role);
      setDashlaneRef(account.dashlane_ref || '');
    }
  }, [account]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;

    onSave({
      username: username.trim(),
      role,
      dashlane_ref: dashlaneRef.trim() || null,
    });
  };

  const isEditing = account !== null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content joomla-account-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEditing ? 'Modifier le compte' : 'Ajouter un compte Joomla'}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">Nom d'utilisateur</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Ex: admin, editeur1"
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="role">Rôle / Niveau d'accès</label>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              required
            >
              {ROLE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="dashlane">Référence Dashlane (optionnel)</label>
            <input
              id="dashlane"
              type="text"
              value={dashlaneRef}
              onChange={(e) => setDashlaneRef(e.target.value)}
              placeholder="Ex: [Site] Éditeur 1"
            />
          </div>

          <div className="modal-actions">
            {isEditing && onDelete && (
              <Button
                type="button"
                variant="danger"
                onClick={onDelete}
              >
                Supprimer
              </Button>
            )}
            <div className="actions-right">
              <Button type="button" variant="secondary" onClick={onClose}>
                Annuler
              </Button>
              <Button type="submit" variant="primary">
                {isEditing ? 'Enregistrer' : 'Ajouter'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

import { useState, useEffect } from 'react';
import { Extension } from '../types';
import { Button } from './Button';
import './ExtensionModal.css';

interface ExtensionModalProps {
  extension: Extension | null; // null = ajout, sinon édition
  onSave: (extension: Extension) => void;
  onDelete?: () => void;
  onClose: () => void;
}

export const ExtensionModal: React.FC<ExtensionModalProps> = ({
  extension,
  onSave,
  onDelete,
  onClose,
}) => {
  const [name, setName] = useState('');
  const [version, setVersion] = useState('');
  const [critical, setCritical] = useState(false);

  useEffect(() => {
    if (extension) {
      setName(extension.name);
      setVersion(extension.version || '');
      setCritical(extension.critical);
    }
  }, [extension]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onSave({
      name: name.trim(),
      version: version.trim() || null,
      critical,
    });
  };

  const isEditing = extension !== null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content extension-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEditing ? 'Modifier l\'extension' : 'Ajouter une extension'}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name">Nom de l'extension</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Akeeba Backup"
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="version">Version (optionnel)</label>
            <input
              id="version"
              type="text"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="Ex: 10.2.2"
            />
          </div>

          <div className="form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={critical}
                onChange={(e) => setCritical(e.target.checked)}
              />
              Extension critique (affichée en priorité)
            </label>
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

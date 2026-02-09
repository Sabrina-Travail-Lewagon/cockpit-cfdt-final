import { useState, useEffect } from 'react';
import { Intervention } from '../types';
import { Button } from './Button';
import './InterventionModal.css';

interface InterventionModalProps {
  intervention: Intervention | null; // null = ajout, sinon édition
  onSave: (intervention: Intervention) => void;
  onDelete?: () => void;
  onClose: () => void;
}

const INTERVENTION_TYPES = [
  'Mise à jour Joomla',
  'Mise à jour extensions',
  'Mise à jour PHP',
  'Correction de bug',
  'Modification contenu',
  'Nouveau module',
  'Sauvegarde',
  'Migration',
  'Optimisation',
  'Sécurité',
  'Autre',
];

const RESULT_OPTIONS = [
  'Succès',
  'Partiel',
  'Échec',
  'En cours',
  'À vérifier',
];

export const InterventionModal: React.FC<InterventionModalProps> = ({
  intervention,
  onSave,
  onDelete,
  onClose,
}) => {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [typeIntervention, setTypeIntervention] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState('');
  const [result, setResult] = useState('Succès');

  useEffect(() => {
    if (intervention) {
      setDate(intervention.date);
      setTypeIntervention(intervention.type_intervention);
      setDescription(intervention.description);
      setDuration(intervention.duration);
      setResult(intervention.result);
    }
  }, [intervention]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!typeIntervention.trim() || !description.trim()) return;

    onSave({
      date,
      type_intervention: typeIntervention,
      description: description.trim(),
      duration: duration.trim() || 'Non spécifié',
      result,
    });
  };

  const isEditing = intervention !== null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content intervention-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEditing ? 'Modifier l\'intervention' : 'Ajouter une intervention'}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="date">Date</label>
              <input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="duration">Durée</label>
              <input
                id="duration"
                type="text"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="Ex: 30 min, 2h"
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="type">Type d'intervention</label>
            <select
              id="type"
              value={typeIntervention}
              onChange={(e) => setTypeIntervention(e.target.value)}
              required
            >
              <option value="">Sélectionner un type...</option>
              {INTERVENTION_TYPES.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Décrivez l'intervention..."
              rows={4}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="result">Résultat</label>
            <select
              id="result"
              value={result}
              onChange={(e) => setResult(e.target.value)}
              required
            >
              {RESULT_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
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

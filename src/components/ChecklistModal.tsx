import { useState, useEffect } from 'react';
import { ChecklistItem } from '../types';
import { Button } from './Button';
import './ChecklistModal.css';

interface ChecklistModalProps {
  item: ChecklistItem | null; // null = ajout, sinon édition
  onSave: (item: ChecklistItem) => void;
  onDelete?: () => void;
  onClose: () => void;
}

export const ChecklistModal: React.FC<ChecklistModalProps> = ({
  item,
  onSave,
  onDelete,
  onClose,
}) => {
  const [task, setTask] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (item) {
      setTask(item.task);
      setDone(item.done);
    }
  }, [item]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!task.trim()) return;

    onSave({
      task: task.trim(),
      done,
      date: done ? (item?.date || new Date().toISOString().split('T')[0]) : null,
    });
  };

  const isEditing = item !== null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content checklist-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEditing ? 'Modifier la tâche' : 'Ajouter une tâche'}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="task">Tâche</label>
            <input
              id="task"
              type="text"
              value={task}
              onChange={(e) => setTask(e.target.value)}
              placeholder="Ex: Vérifier les mises à jour Joomla"
              autoFocus
              required
            />
          </div>

          <div className="form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={done}
                onChange={(e) => setDone(e.target.checked)}
              />
              Tâche terminée
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

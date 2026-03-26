import { useState } from 'react';

interface RubricToolbarProps {
  rubricName: string;
  onRubricNameChange: (name: string) => void;
  onAddCategory: (name: string) => void;
  onAddScore: (value: number) => void;
  className?: string;
}

export function RubricToolbar(props: RubricToolbarProps) {
  const { rubricName, onRubricNameChange, onAddCategory, onAddScore, className } = props;
  const [categoryName, setCategoryName] = useState('');
  const [scoreValue, setScoreValue] = useState('');

  const submitCategory = () => {
    const next = categoryName.trim();
    if (!next) return;
    onAddCategory(next);
    setCategoryName('');
  };

  const submitScore = () => {
    const next = Number(scoreValue);
    if (!Number.isFinite(next)) return;
    onAddScore(next);
    setScoreValue('');
  };

  return (
    <div className={['rubric-toolbar', className].filter(Boolean).join(' ')}>
      <label className="rubric-toolbar__title">
        Rubric Name
        <input
          value={rubricName}
          onChange={(event) => onRubricNameChange(event.target.value)}
          placeholder="Rubric name"
        />
      </label>

      <form
        className="rubric-toolbar__controls"
        onSubmit={(event) => {
          event.preventDefault();
          submitCategory();
        }}
      >
        <label>
          New Category
          <input
            value={categoryName}
            onChange={(event) => setCategoryName(event.target.value)}
            placeholder="e.g. Organization"
          />
        </label>
        <button type="submit">Add Category</button>
      </form>

      <form
        className="rubric-toolbar__controls"
        onSubmit={(event) => {
          event.preventDefault();
          submitScore();
        }}
      >
        <label>
          New Score
          <input
            value={scoreValue}
            onChange={(event) => setScoreValue(event.target.value)}
            placeholder="e.g. 5"
            inputMode="numeric"
          />
        </label>
        <button type="submit">Add Score</button>
      </form>
    </div>
  );
}

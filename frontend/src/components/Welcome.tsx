import { useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowRight } from 'lucide-react';

interface Props {
  title: string;
  subtitle: string;
  label: string;
  placeholder: string;
  submit: string;
  error: string | null;
  disabled: boolean;
  onClaim: (nickname: string) => void;
}

export function Welcome({ title, subtitle, label, placeholder, submit, error, disabled, onClaim }: Props) {
  const [nickname, setNickname] = useState('');
  const trimmed = nickname.trim();

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (trimmed) onClaim(trimmed);
  };

  return (
    <main className="welcome">
      <form className="welcome__card" onSubmit={handleSubmit}>
        <span className="welcome__glyph" aria-hidden>♚</span>
        <h1 className="welcome__title">{title}</h1>
        <p className="muted">{subtitle}</p>

        <label className="welcome__field">
          <span className="caption">{label}</span>
          <input
            className={`field field--large ${error ? 'field--invalid' : ''}`}
            value={nickname}
            maxLength={24}
            autoFocus
            autoComplete="off"
            spellCheck={false}
            placeholder={placeholder}
            onChange={(event) => setNickname(event.target.value)}
          />
          <span className="field__error" role="alert">{error}</span>
        </label>

        <button className="button button--primary button--large" type="submit" disabled={disabled || !trimmed}>
          {submit}
          <ArrowRight size={18} />
        </button>
      </form>
    </main>
  );
}

import type { ConnectionStatus } from '../hooks/useConnection';
import type { Lang } from '../i18n';

interface Props {
  status: ConnectionStatus;
  nickname: string | null;
  lang: Lang;
  onLang: (lang: Lang) => void;
  labels: { connected: string; connecting: string; reconnecting: string; language: string };
}

export function Header({ status, nickname, lang, onLang, labels }: Props) {
  const statusLabel = { open: labels.connected, connecting: labels.connecting, closed: labels.reconnecting }[status];

  return (
    <header className="header">
      <div className="brand">
        <span className="brand__mark" aria-hidden>♞</span>
        <span className="brand__name">chess-rs</span>
      </div>

      <div className="header__trailing">
        <span className={`status status--${status}`}>
          <span className="status__dot" />
          {statusLabel}
        </span>
        {nickname && <span className="chip">{nickname}</span>}
        <div className="segmented" role="group" aria-label={labels.language}>
          {(['pt', 'en'] as const).map((option) => (
            <button
              key={option}
              type="button"
              className={`segmented__item ${option === lang ? 'is-selected' : ''}`}
              aria-pressed={option === lang}
              onClick={() => onLang(option)}
            >
              {option.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}

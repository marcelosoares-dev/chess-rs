import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowUp } from 'lucide-react';
import type { ChatLine } from '../state/store';

interface Props {
  title: string;
  lines: ChatLine[];
  me: string;
  placeholder: string;
  empty: string;
  sendLabel: string;
  onSend: (text: string) => void;
}

export function Chat({ title, lines, me, placeholder, empty, sendLabel, onSend }: Props) {
  const [draft, setDraft] = useState('');
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' });
  }, [lines.length]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    onSend(text);
    setDraft('');
  };

  return (
    <section className="panel chat">
      <h2 className="panel__title">{title}</h2>
      <div className="chat__lines" ref={scroller}>
        {lines.length === 0 && <p className="muted chat__empty">{empty}</p>}
        {lines.map((line) => (
          <div key={line.id} className={`bubble ${line.sender === me ? 'bubble--mine' : ''}`}>
            {line.sender !== me && <span className="bubble__sender">{line.sender}</span>}
            <span className="bubble__text">{line.text}</span>
          </div>
        ))}
      </div>
      <form className="chat__form" onSubmit={submit}>
        <input
          className="field"
          value={draft}
          maxLength={500}
          placeholder={placeholder}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button className="icon-button" type="submit" aria-label={sendLabel} disabled={!draft.trim()}>
          <ArrowUp size={16} strokeWidth={2.5} />
        </button>
      </form>
    </section>
  );
}

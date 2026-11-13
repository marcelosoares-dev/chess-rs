import { AnimatePresence, motion } from 'framer-motion';
import type { LobbyEntry } from '../protocol';
import type { ChatLine } from '../state/store';
import { Chat } from './Chat';

interface Props {
  me: string;
  players: LobbyEntry[];
  chat: ChatLine[];
  incoming: { nickname: string } | null;
  t: (key: LobbyKey, params?: Record<string, string | number>) => string;
  onChallenge: (nickname: string) => void;
  onAccept: () => void;
  onDecline: () => void;
  onChat: (text: string) => void;
}

type LobbyKey =
  | 'lobbyTitle' | 'online' | 'lobbyEmpty' | 'lobbyEmptyHint' | 'challenge' | 'lobbyChat'
  | 'chatPlaceholder' | 'chatEmpty' | 'send' | 'challengeFrom' | 'accept' | 'decline';

const initial = (name: string) => name.trim().charAt(0).toUpperCase();

export function Lobby({ me, players, chat, incoming, t, onChallenge, onAccept, onDecline, onChat }: Props) {
  const others = players.filter((player) => player.nickname !== me);

  return (
    <main className="lobby">
      <section className="panel">
        <header className="panel__header">
          <h1 className="panel__title panel__title--large">{t('lobbyTitle')}</h1>
          <span className="muted">{t('online', { n: players.length })}</span>
        </header>

        <AnimatePresence initial={false}>
          {incoming && (
            <motion.div
              className="invite"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
            >
              <div className="invite__inner">
                <span className="invite__text">{t('challengeFrom', { name: incoming.nickname })}</span>
                <div className="row">
                  <button className="button button--ghost" onClick={onDecline}>{t('decline')}</button>
                  <button className="button button--primary" onClick={onAccept}>{t('accept')}</button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {others.length === 0 ? (
          <div className="empty">
            <span className="empty__glyph" aria-hidden>♟</span>
            <strong>{t('lobbyEmpty')}</strong>
            <span className="muted">{t('lobbyEmptyHint')}</span>
          </div>
        ) : (
          <ul className="list">
            <AnimatePresence initial={false}>
              {others.map((player) => (
                <motion.li
                  key={player.conn_id}
                  layout
                  className="list__row"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}
                >
                  <span className="avatar">{initial(player.nickname)}</span>
                  <span className="list__name">{player.nickname}</span>
                  <button className="button button--tinted" onClick={() => onChallenge(player.nickname)}>
                    {t('challenge')}
                  </button>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </section>

      <Chat
        title={t('lobbyChat')}
        lines={chat}
        me={me}
        placeholder={t('chatPlaceholder')}
        empty={t('chatEmpty')}
        sendLabel={t('send')}
        onSend={onChat}
      />
    </main>
  );
}

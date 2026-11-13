import { Chess } from 'chess.js';
import { Loader2 } from 'lucide-react';
import { useCallback, useMemo, useReducer } from 'react';
import { Dialog } from './components/Dialog';
import { Header } from './components/Header';
import { Lobby } from './components/Lobby';
import { MatchView } from './components/MatchView';
import { Toast } from './components/Toast';
import { Welcome } from './components/Welcome';
import { useConnection } from './hooks/useConnection';
import { translate } from './i18n';
import type { MessageKey, Params } from './i18n';
import { outcomeOf, sideToMove } from './lib/chess';
import type { ServerMessage } from './protocol';
import { initialState, reduce } from './state/store';

function App() {
  const [state, dispatch] = useReducer(reduce, undefined, () => initialState(navigator.language.startsWith('en') ? 'en' : 'pt'));
  const { lang, nickname, match, players, incoming, outgoing, lobbyChat, notice } = state;

  const onMessage = useCallback((message: ServerMessage) => {
    dispatch({ type: 'server', message, at: performance.now() });
  }, []);
  const { status, send } = useConnection(onMessage);

  const t = useCallback((key: MessageKey, params?: Params) => translate(lang, key, params), [lang]);

  const noticeText = useMemo(() => {
    if (!notice) return null;
    return 'text' in notice ? notice.text : translate(lang, notice.key, notice.params);
  }, [notice, lang]);

  const playMove = useCallback(
    (from: string, to: string) => {
      if (!match || match.departure) return false;
      const chess = new Chess(match.fen);
      if (outcomeOf(chess, match.timeoutWinner)) return false;
      if (sideToMove(chess) !== match.color) {
        dispatch({ type: 'noticed', key: 'notYourTurn' });
        return false;
      }
      try {
        const move = chess.move({ from, to, promotion: 'q' });
        if (!send({ type: 'MakeMove', payload: { game_id: match.id, from, to } })) return false;
        dispatch({
          type: 'moved',
          move: { san: move.san, from: move.from, to: move.to },
          fen: chess.fen(),
          at: performance.now(),
        });
        return true;
      } catch {
        return false;
      }
    },
    [match, send],
  );

  const dismissNotice = useCallback(() => dispatch({ type: 'noticeDismissed' }), []);
  const returnToLobby = useCallback(() => dispatch({ type: 'matchLeft' }), []);

  const view = (() => {
    if (!nickname) {
      return (
        <Welcome
          title={t('welcomeTitle')}
          subtitle={t('welcomeSubtitle')}
          label={t('nicknameLabel')}
          placeholder={t('nicknamePlaceholder')}
          submit={t('enter')}
          error={state.nicknameRejected ? t('nicknameRejected') : null}
          disabled={status !== 'open'}
          onClaim={(value) => send({ type: 'ClaimNickname', payload: { nickname: value } })}
        />
      );
    }
    if (match) {
      return (
        <MatchView
          match={match}
          me={nickname}
          t={t}
          onMove={playMove}
          onRematch={() => send({ type: 'ResetGame', payload: { game_id: match.id } })}
          onResign={() => send({ type: 'QuitGame', payload: { game_id: match.id } })}
          onReturn={returnToLobby}
          onChat={(message) => send({ type: 'ChatMessage', payload: { message } })}
        />
      );
    }
    return (
      <Lobby
        me={nickname}
        players={players}
        chat={lobbyChat}
        incoming={incoming}
        t={t}
        onChallenge={(target) => {
          if (send({ type: 'SendChallenge', payload: { target_nickname: target } })) {
            dispatch({ type: 'challengeSent', to: target });
          }
        }}
        onAccept={() => {
          if (!incoming) return;
          send({ type: 'AcceptChallenge', payload: { from_conn_id: incoming.connId } });
          dispatch({ type: 'incomingCleared' });
        }}
        onDecline={() => {
          if (!incoming) return;
          send({ type: 'DeclineChallenge', payload: { from_conn_id: incoming.connId } });
          dispatch({ type: 'incomingCleared' });
        }}
        onChat={(message) => send({ type: 'ChatMessage', payload: { message } })}
      />
    );
  })();

  return (
    <div className="app">
      <Header
        status={status}
        nickname={nickname}
        lang={lang}
        onLang={(next) => dispatch({ type: 'language', lang: next })}
        labels={{
          connected: t('connected'),
          connecting: t('connecting'),
          reconnecting: t('reconnecting'),
          language: t('language'),
        }}
      />
      {view}

      <Dialog
        open={outgoing !== null && !match}
        title={t('challengeSentTitle')}
        icon={<Loader2 className="spinner" size={28} />}
        actions={
          <button className="button button--ghost" onClick={() => dispatch({ type: 'challengeCleared' })}>
            {t('cancel')}
          </button>
        }
      >
        <p className="muted">{t('challengeSentWait', { name: outgoing ?? '' })}</p>
      </Dialog>

      <Toast id={notice?.id ?? null} text={noticeText} onDismiss={dismissNotice} />
    </div>
  );
}

export default App;

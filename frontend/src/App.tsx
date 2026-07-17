import React, { useState, useEffect, useRef } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import { useWebSocket } from './hooks/useWebSocket';
import { Wifi, WifiOff, Send, Trophy, User, ArrowRight, Clock } from 'lucide-react';

const getInitialRoom = () => {
  const params = new URLSearchParams(window.location.search);
  return params.get('room') || 'blitz-palace';
};

const translations = {
  pt: {
    title: "chess-rs multiplayer",
    subtitle: "Escolha seu nickname exclusivo para entrar no saguão",
    nicknameLabel: "Seu Apelido",
    nicknamePlaceholder: "Digite seu nickname...",
    nicknameButton: "Entrar no Saguão",
    connecting: "Conectando ao servidor...",
    connected: "Conectado ao servidor",
    language: "Idioma",
    lobbyTitle: "Desafiar Jogadores",
    lobbySubtitle: "Envie uma proposta de partida para um jogador ativo no saguão",
    lobbyEmpty: "Nenhum outro jogador disponível no momento...",
    lobbyEmptySub: "Abra o jogo em outra aba ou envie o endereço para um amigo para desafiá-lo!",
    challenge: "Desafiar",
    lobbyChat: "Chat do Saguão",
    lobbyChatPlaceholder: "Escreva no saguão...",
    lobbyChatEmpty: "Sem mensagens no saguão. Comece o papo!",
    challengeSentTitle: "Desafio Enviado!",
    challengeSentWait: "Aguardando {name} aceitar o desafio...",
    cancel: "Cancelar",
    challengeReceived: "desafiou você!",
    accept: "Aceitar",
    decline: "Recusar",
    activeMatch: "Partida Ativa",
    abandonMatch: "Abandonar Partida",
    gameId: "ID do jogo",
    rematch: "Jogar Novamente (Revanche)",
    matchChat: "Chat da Partida",
    matchChatEmpty: "Silêncio no chat. Diga algo ao seu oponente!",
    matchChatPlaceholder: "Escreva uma mensagem...",
    victoryWO: "Vitória por Abandono!",
    victoryWODesc: "O jogador {name} abandonou a partida. Você foi declarado o vencedor!",
    victoryWOReturn: "Retornando ao saguão em {sec} segundos...",
    victoryWOButton: "Voltar ao Saguão Agora",
    waitingOpponent: "Aguardando Conexão...",
    waitingOpponentDesc: "Aguardando a reconexão ou resposta do oponente.",
    turn: "Vez de jogar",
    check: "Xeque!",
    gameOver: "Fim de Jogo!",
    you: "Você", oponente: "Oponente",
    loggedAs: "Logado como",
    connectedStatus: "Conectado",
    disconnectedStatus: "Desconectado",
    spectatorWarning: "Espectadores não podem fazer jogadas!",
    gameOverWarning: "O jogo já terminou!",
    turnWarning: "Não é o seu turno de jogar!",
    opponentWarning: "Aguardando a entrada do oponente!",
    ownPiecesWarning: "Você só pode mover suas próprias peças!",
    invalidMoveWarning: "Movimento inválido!",
    systemWelcome: 'Você entrou no saguão global com o apelido "{nick}".',
    systemOpponentDisconnected: "O oponente desconectou da partida. Você retornará ao saguão em 10 segundos.",
    systemSelfQuit: "Você abandonou a partida e retornou ao saguão.",
    systemOpponentQuit: 'O oponente "{by}" abandonou a partida. Você retornará ao saguão em 10 segundos.',
    opponentJoined: "O oponente (Jogador {id}) entrou como {colorName}.",
    opponentLeft: "O oponente (Jogador {id}) saiu da partida.",
    opponentDeclined: "O oponente {name} recusou o seu desafio.",
    nicknameRejected: "Nickname inválido ou em uso!",
  },
  en: {
    title: "chess-rs multiplayer",
    subtitle: "Choose your unique nickname to enter the lobby",
    nicknameLabel: "Your Nickname",
    nicknamePlaceholder: "Enter your nickname...",
    nicknameButton: "Enter Lobby",
    connecting: "Connecting to server...",
    connected: "Connected to server",
    language: "Language",
    lobbyTitle: "Challenge Players",
    lobbySubtitle: "Send a match request to an active player in the lobby",
    lobbyEmpty: "No other players available at the moment...",
    lobbyEmptySub: "Open the game in another tab or send the address to a friend to challenge them!",
    challenge: "Challenge",
    lobbyChat: "Lobby Chat",
    lobbyChatPlaceholder: "Write in the lobby...",
    lobbyChatEmpty: "No messages in the lobby. Start the conversation!",
    challengeSentTitle: "Challenge Sent!",
    challengeSentWait: "Waiting for {name} to accept the challenge...",
    cancel: "Cancel",
    challengeReceived: "challenged you!",
    accept: "Accept",
    decline: "Decline",
    activeMatch: "Active Match",
    abandonMatch: "Forfeit Match",
    gameId: "Game ID",
    rematch: "Play Again (Rematch)",
    matchChat: "Match Chat",
    matchChatEmpty: "Silence in chat. Say something to your opponent!",
    matchChatPlaceholder: "Write a message...",
    victoryWO: "Victory by Forfeit!",
    victoryWODesc: "Player {name} forfeited the match. You have been declared the winner!",
    victoryWOReturn: "Returning to lobby in {sec} seconds...",
    victoryWOButton: "Go back to Lobby Now",
    waitingOpponent: "Waiting for Connection...",
    waitingOpponentDesc: "Waiting for the opponent's connection or response.",
    turn: "Turn to play",
    check: "Check!",
    gameOver: "Game Over!",
    you: "You", oponente: "Opponent",
    loggedAs: "Logged in as",
    connectedStatus: "Connected",
    disconnectedStatus: "Disconnected",
    spectatorWarning: "Spectators cannot make moves!",
    gameOverWarning: "The game has already ended!",
    turnWarning: "It is not your turn to play!",
    opponentWarning: "Waiting for the opponent to join!",
    ownPiecesWarning: "You can only move your own pieces!",
    invalidMoveWarning: "Invalid move!",
    systemWelcome: 'You entered the global lobby with the nickname "{nick}".',
    systemOpponentDisconnected: "The opponent disconnected from the match. You will return to the lobby in 10 seconds.",
    systemSelfQuit: "You forfeited the match and returned to the lobby.",
    systemOpponentQuit: 'Opponent "{by}" forfeited the match. You will return to the lobby in 10 seconds.',
    opponentJoined: "The opponent (Player {id}) joined as {colorName}.",
    opponentLeft: "The opponent (Player {id}) left the match.",
    opponentDeclined: "The opponent {name} declined your challenge.",
    nicknameRejected: "Invalid nickname or already in use!",
  }
};

function App() {
  const wsUrl = `ws://${window.location.hostname}:8080/ws`;
  const { isConnected, messages, sendMessage } = useWebSocket(wsUrl);
  const [lang, setLang] = useState<'pt' | 'en'>('pt');
  const [customMessage, setCustomMessage] = useState<string>('');
  
  const initialRoom = getInitialRoom();
  const [currentRoom, setCurrentRoom] = useState<string>(initialRoom);
  
  const chessRef = useRef(new Chess());
  const [gameFen, setGameFen] = useState<string>(chessRef.current.fen());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [playerColor, setPlayerColor] = useState<'white' | 'black' | 'spectator'>('white');

  const [whiteTime, setWhiteTime] = useState<number>(300000);
  const [blackTime, setBlackTime] = useState<number>(300000);
  const [gameStarted, setGameStarted] = useState<boolean>(false);
  const [timeoutWinner, setTimeoutWinner] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<Array<{ sender: string; message: string; isSystem?: boolean }>>([]);
  const [hasOpponent, setHasOpponent] = useState<boolean>(false);

  const [myNickname, setMyNickname] = useState<string | null>(null);
  const [nicknameInput, setNicknameInput] = useState<string>('');
  const [nicknameError, setNicknameError] = useState<string | null>(null);
  const [availablePlayers, setAvailablePlayers] = useState<Array<{ conn_id: string; nickname: string }>>([]);
  const [isInLobby, setIsInLobby] = useState<boolean>(true);
  const [opponentNickname, setOpponentNickname] = useState<string | null>(null);
  const [opponentQuitCountdown, setOpponentQuitCountdown] = useState<number | null>(null);
  const [quitterName, setQuitterName] = useState<string>('');

  const [outgoingChallengeTo, setOutgoingChallengeTo] = useState<string | null>(null);
  const [incomingChallenge, setIncomingChallenge] = useState<{ from_conn_id: string; from_nickname: string } | null>(null);

  const lastMessage = messages[messages.length - 1];
  const consoleEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (consoleEndRef.current) {
      consoleEndRef.current.scrollTop = consoleEndRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const handleReturnToLobbyImmediately = () => {
    setOpponentQuitCountdown(null);
    setIsInLobby(true);
    setHasOpponent(false);
    setOpponentNickname(null);
    setGameStarted(false);
    setTimeoutWinner(null);
    chessRef.current = new Chess();
    setGameFen(chessRef.current.fen());
  };

  useEffect(() => {
    if (opponentQuitCountdown === null) return;
    if (opponentQuitCountdown === 0) {
      handleReturnToLobbyImmediately();
      return;
    }
    const timer = setTimeout(() => {
      setOpponentQuitCountdown((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);
    return () => clearTimeout(timer);
  }, [opponentQuitCountdown]);

  useEffect(() => {
    if (!lastMessage) return;

    switch (lastMessage.type) {
      case 'NicknameAccepted': {
        const nick = lastMessage.payload?.nickname;
        setMyNickname(nick);
        setNicknameError(null);
        setIsInLobby(true);
        setChatMessages((prev) => [...prev, {
          sender: 'Sistema',
          message: translations[lang].systemWelcome.replace("{nick}", nick),
          isSystem: true
        }]);
        break;
      }
      case 'NicknameRejected': {
        setNicknameError(lastMessage.payload?.message || translations[lang].nicknameRejected);
        break;
      }
      case 'LobbyUpdate': {
        const list = lastMessage.payload?.players || [];
        setAvailablePlayers(list);
        break;
      }
      case 'ChallengeReceived': {
        setIncomingChallenge({
          from_conn_id: lastMessage.payload?.from_conn_id,
          from_nickname: lastMessage.payload?.from_nickname
        });
        break;
      }
      case 'ChallengeDeclined': {
        setChatMessages((prev) => [...prev, {
          sender: 'Sistema',
          message: translations[lang].opponentDeclined.replace("{name}", lastMessage.payload?.from_nickname),
          isSystem: true
        }]);
        setOutgoingChallengeTo(null);
        break;
      }
      case 'ChallengeAccepted': {
        const { game_id, color, opponent_nickname, fen, white_time_ms, black_time_ms, game_started } = lastMessage.payload;
        setPlayerColor(color);
        setCurrentRoom(game_id);
        setOpponentNickname(opponent_nickname);
        setIsInLobby(false);
        setHasOpponent(true);
        setOutgoingChallengeTo(null);
        setIncomingChallenge(null);

        if (white_time_ms !== undefined) setWhiteTime(white_time_ms);
        if (black_time_ms !== undefined) setBlackTime(black_time_ms);
        if (game_started !== undefined) setGameStarted(game_started);
        setTimeoutWinner(null);
        setErrorMessage(null);

        if (fen) {
          try {
            chessRef.current.load(fen);
            setGameFen(fen);
          } catch (e) {
            console.error('Erro ao carregar FEN do desafio:', e);
          }
        }
        break;
      }
      case 'GameExited':
      case 'OpponentDisconnected': {
        const reason = lastMessage.payload?.reason;
        const by = lastMessage.payload?.by || 'Oponente';

        if (reason === 'self_quit') {
          setMyNickname(null);
          setNicknameInput('');
          setChatMessages([]);
          setIsInLobby(true);
          setHasOpponent(false);
          setOpponentNickname(null);
          setGameStarted(false);
          setTimeoutWinner(null);
          chessRef.current = new Chess();
          setGameFen(chessRef.current.fen());
        } else {
          const isDrop = lastMessage.type === 'OpponentDisconnected';
          setQuitterName(isDrop ? (lang === 'pt' ? 'Oponente (Desconectou)' : 'Opponent (Disconnected)') : by);
          setOpponentQuitCountdown(10);

          const systemMessage = isDrop
            ? translations[lang].systemOpponentDisconnected
            : translations[lang].systemOpponentQuit.replace('{by}', by);

          setChatMessages((prev) => [...prev, {
            sender: lang === 'pt' ? 'Sistema' : 'System',
            message: systemMessage,
            isSystem: true
          }]);
        }
        break;
      }
      case 'GameState': {
        const fen = lastMessage.payload?.fen;
        if (lastMessage.payload?.white_time_ms !== undefined) setWhiteTime(lastMessage.payload.white_time_ms);
        if (lastMessage.payload?.black_time_ms !== undefined) setBlackTime(lastMessage.payload.black_time_ms);
        if (lastMessage.payload?.game_started !== undefined) setGameStarted(lastMessage.payload.game_started);
        setTimeoutWinner(lastMessage.payload?.timeout_winner || null);

        if (fen) {
          try {
            chessRef.current.load(fen);
            setGameFen(fen);
            setErrorMessage(null);
          } catch (e) {
            console.error('Erro ao carregar FEN reiniciado:', e);
          }
        }
        break;
      }
      case 'MoveResponse': {
        const newFen = lastMessage.payload?.fen;
        
        if (lastMessage.payload?.white_time_ms !== undefined) setWhiteTime(lastMessage.payload.white_time_ms);
        if (lastMessage.payload?.black_time_ms !== undefined) setBlackTime(lastMessage.payload.black_time_ms);
        if (lastMessage.payload?.game_started !== undefined) setGameStarted(lastMessage.payload.game_started);
        setTimeoutWinner(lastMessage.payload?.timeout_winner || null);

        if (newFen) {
          try {
            chessRef.current.load(newFen);
            setGameFen(newFen);
            setErrorMessage(null);
          } catch (e) {
            console.error('Erro ao carregar FEN atualizado:', e);
          }
        }
        break;
      }
      case 'PlayerJoined': {
        const joinedColor = lastMessage.payload?.color;
        const joinedColorName = joinedColor === 'white' 
          ? (lang === 'pt' ? 'Brancas' : 'White') 
          : joinedColor === 'black' 
            ? (lang === 'pt' ? 'Pretas' : 'Black') 
            : (lang === 'pt' ? 'Espectador' : 'Spectator');
        setChatMessages((prev) => [...prev, {
          sender: lang === 'pt' ? 'Sistema' : 'System',
          message: translations[lang].opponentJoined.replace('{id}', lastMessage.payload?.player_id).replace('{colorName}', joinedColorName),
          isSystem: true
        }]);

        if (playerColor === 'white' && joinedColor === 'black') {
          setHasOpponent(true);
        } else if (playerColor === 'black' && joinedColor === 'white') {
          setHasOpponent(true);
        }
        break;
      }
      case 'PlayerLeft': {
        const leftColor = lastMessage.payload?.color;
        setChatMessages((prev) => [...prev, {
          sender: lang === 'pt' ? 'Sistema' : 'System',
          message: translations[lang].opponentLeft.replace('{id}', lastMessage.payload?.player_id),
          isSystem: true
        }]);

        if (playerColor === 'white' && leftColor === 'black') {
          setHasOpponent(false);
        } else if (playerColor === 'black' && leftColor === 'white') {
          setHasOpponent(false);
        }
        break;
      }
      case 'ChatMessageEcho': {
        const senderId = lastMessage.payload?.sender || 'Jogador';
        const msg = lastMessage.payload?.message || '';
        const cleanSender = senderId.startsWith('Player_')
          ? `${lang === 'pt' ? 'Jogador' : 'Player'} ${senderId.replace('Player_', '')}`
          : senderId;
        setChatMessages((prev) => [...prev, { sender: cleanSender, message: msg }]);
        break;
      }
      case 'Error': {
        const err = lastMessage.payload?.message || (lang === 'pt' ? 'Movimento ilegal rejeitado pelo servidor' : 'Illegal move rejected by server');
        setErrorMessage(err);
        setGameFen(chessRef.current.fen());
        break;
      }
      default:
        break;
    }
  }, [lastMessage]);

  const handleClaimNickname = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nicknameInput.trim()) return;
    sendMessage({
      type: 'ClaimNickname',
      payload: { nickname: nicknameInput.trim() },
    });
  };

  const handleSendChallenge = (targetNickname: string) => {
    setOutgoingChallengeTo(targetNickname);
    sendMessage({
      type: 'SendChallenge',
      payload: { target_nickname: targetNickname },
    });
  };

  const handleAcceptChallenge = () => {
    if (!incomingChallenge) return;
    sendMessage({
      type: 'AcceptChallenge',
      payload: { from_conn_id: incomingChallenge.from_conn_id },
    });
  };

  const handleDeclineChallenge = () => {
    if (!incomingChallenge) return;
    sendMessage({
      type: 'DeclineChallenge',
      payload: { from_conn_id: incomingChallenge.from_conn_id },
    });
    setIncomingChallenge(null);
  };

  const handleQuitGame = () => {
    sendMessage({
      type: 'QuitGame',
      payload: { game_id: currentRoom },
    });
  };

  const handleSendTestMessage = () => {
    if (!customMessage.trim()) return;
    sendMessage({
      type: 'ChatMessage',
      payload: {
        message: customMessage,
      },
    });
    setCustomMessage('');
  };


  const handleRequestRematch = () => {
    sendMessage({
      type: 'ResetGame',
      payload: {
        game_id: currentRoom,
      },
    });
  };

  const onPieceDrop = ({ piece, sourceSquare, targetSquare }: { piece: any; sourceSquare: string; targetSquare: string | null }) => {
    if (!targetSquare) return false;

    if (playerColor === 'spectator') {
      setErrorMessage(translations[lang].spectatorWarning);
      return false;
    }

    if (timeoutWinner || chessRef.current.isGameOver()) {
      setErrorMessage(translations[lang].gameOverWarning);
      return false;
    }

    const expectedTurnColor = chessRef.current.turn() === 'w' ? 'white' : 'black';
    if (playerColor !== expectedTurnColor) {
      setErrorMessage(translations[lang].turnWarning);
      return false;
    }

    if (!hasOpponent) {
      setErrorMessage(translations[lang].opponentWarning);
      return false;
    }

    const pieceTypeStr = typeof piece === 'string' ? piece : (piece?.pieceType || '');
    const pieceColor = pieceTypeStr.startsWith('w') ? 'white' : 'black';
    if (pieceColor !== playerColor) {
      setErrorMessage(translations[lang].ownPiecesWarning);
      return false;
    }

    try {
      const move = chessRef.current.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: 'q',
      });

      if (move) {
        setGameFen(chessRef.current.fen());
        setErrorMessage(null);
        setGameStarted(true);

        sendMessage({
          type: 'MakeMove',
          payload: {
            game_id: currentRoom,
            from: sourceSquare,
            to: targetSquare,
          },
        });
        return true;
      }
    } catch (e) {
      setErrorMessage(translations[lang].invalidMoveWarning);
      console.log('Local chess.js validation rejected move:', e);
    }
    return false;
  };

  const activeTurn = chessRef.current.turn() === 'w' ? (lang === 'pt' ? 'Brancas' : 'White') : (lang === 'pt' ? 'Pretas' : 'Black');
  const isGameOver = chessRef.current.isGameOver() || timeoutWinner !== null;
  const isCheck = chessRef.current.inCheck();

  const getGameOverReason = () => {
    const isPt = lang === 'pt';
    if (timeoutWinner) {
      const winner = timeoutWinner === 'white' 
        ? (isPt ? 'Brancas' : 'White') 
        : (isPt ? 'Pretas' : 'Black');
      return isPt 
        ? `Tempo Esgotado! Vitória das ${winner}!` 
        : `Time Out! ${winner} won!`;
    }
    if (chessRef.current.isCheckmate()) {
      const loser = chessRef.current.turn() === 'w' 
        ? (isPt ? 'Brancas' : 'White') 
        : (isPt ? 'Pretas' : 'Black');
      const winner = loser === (isPt ? 'Brancas' : 'White') 
        ? (isPt ? 'Pretas' : 'Black') 
        : (isPt ? 'Brancas' : 'White');
      return isPt 
        ? `Vitória das ${winner} por Xeque-mate!` 
        : `${winner} won by Checkmate!`;
    }
    if (chessRef.current.isStalemate()) {
      return isPt ? 'Empate por Afogamento (Stalemate)!' : 'Draw by Stalemate!';
    }
    if (chessRef.current.isThreefoldRepetition()) {
      return isPt ? 'Empate por Repetição Tripla!' : 'Draw by Threefold Repetition!';
    }
    if (chessRef.current.isInsufficientMaterial()) {
      return isPt ? 'Empate por Material Insuficiente!' : 'Draw by Insufficient Material!';
    }
    if (chessRef.current.isDraw()) {
      return isPt ? 'Empate!' : 'Draw!';
    }
    return isPt ? 'Partida finalizada.' : 'Game over.';
  };



  const formatTime = (timeMs: number) => {
    const totalSeconds = Math.max(0, Math.floor(timeMs / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const getCapturedPieces = (fen: string) => {
    const boardPart = fen.split(' ')[0];
    const pieceCounts = {
      w: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 },
      b: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 }
    };

    for (const char of boardPart) {
      if (char === '/') continue;
      const isDigit = /\d/.test(char);
      if (isDigit) continue;

      const color = char === char.toUpperCase() ? 'w' : 'b';
      const type = char.toLowerCase() as 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
      if (pieceCounts[color][type] !== undefined) {
        pieceCounts[color][type]++;
      }
    }

    const maxCounts = { p: 8, n: 2, b: 2, r: 2, q: 1, k: 1 };
    
    const capturedByWhite: string[] = [];
    const pieceValues = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
    let whiteValue = 0;
    let blackValue = 0;

    for (const [piece, max] of Object.entries(maxCounts)) {
      const pType = piece as 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
      const missing = max - pieceCounts.b[pType];
      for (let i = 0; i < missing; i++) {
        capturedByWhite.push(pType);
      }
      blackValue += pieceCounts.b[pType] * pieceValues[pType];
    }

    const capturedByBlack: string[] = [];
    for (const [piece, max] of Object.entries(maxCounts)) {
      const pType = piece as 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
      const missing = max - pieceCounts.w[pType];
      for (let i = 0; i < missing; i++) {
        capturedByBlack.push(pType);
      }
      whiteValue += pieceCounts.w[pType] * pieceValues[pType];
    }

    return {
      capturedByWhite,
      capturedByBlack,
      materialDiff: whiteValue - blackValue
    };
  };

  const { capturedByWhite, capturedByBlack, materialDiff } = getCapturedPieces(gameFen);

  const unicodeSymbols: Record<string, string> = {
    p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚'
  };

  const getKingSquare = (color: 'w' | 'b'): string => {
    const board = chessRef.current.board();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        if (piece && piece.type === 'k' && piece.color === color) {
          return piece.square;
        }
      }
    }
    return '';
  };

  const getCustomSquareStyles = () => {
    const styles: Record<string, any> = {};

    const history = chessRef.current.history({ verbose: true });
    if (history.length > 0) {
      const lastMove = history[history.length - 1];
      styles[lastMove.from] = {
        backgroundColor: 'rgba(253, 224, 71, 0.25)',
      };
      styles[lastMove.to] = {
        backgroundColor: 'rgba(253, 224, 71, 0.35)',
      };
    }

    if (isCheck) {
      const turn = chessRef.current.turn();
      const kingSquare = getKingSquare(turn);
      if (kingSquare) {
        styles[kingSquare] = {
          backgroundColor: 'rgba(239, 68, 68, 0.45)',
        };
      }
    }

    return styles;
  };

  const renderMoveHistory = () => {
    const rawMoves = chessRef.current.history();
    const rounds: Array<{ round: number; white: string; black?: string }> = [];

    for (let i = 0; i < rawMoves.length; i += 2) {
      rounds.push({
        round: Math.floor(i / 2) + 1,
        white: rawMoves[i],
        black: rawMoves[i + 1]
      });
    }

    return (
      <div className="flex-1 min-h-[160px] bg-slate-950/50 border border-slate-900 rounded-xl p-4 flex flex-col max-h-[220px]">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
          Histórico de Rodadas
        </h3>
        <div className="flex-1 overflow-y-auto">
          {rounds.length === 0 ? (
            <div className="text-slate-600 italic text-center py-8 text-xs">
              Nenhuma jogada registrada.
            </div>
          ) : (
            <table className="w-full text-xs text-left text-slate-300">
              <thead>
                <tr className="border-b border-slate-900 text-slate-500 font-bold">
                  <th className="py-1.5 w-16">#</th>
                  <th className="py-1.5">Brancas</th>
                  <th className="py-1.5">Pretas</th>
                </tr>
              </thead>
              <tbody>
                {rounds.map((r, i) => (
                  <tr key={i} className="border-b border-slate-950/50 hover:bg-slate-900/10">
                    <td className="py-1 font-mono text-slate-500">{r.round}.</td>
                    <td className="py-1 font-medium">{r.white}</td>
                    <td className="py-1 font-medium text-slate-400">{r.black || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    );
  };

  const isWhiteActive = chessRef.current.turn() === 'w' && gameStarted && !isGameOver;
  const isBlackActive = chessRef.current.turn() === 'b' && gameStarted && !isGameOver;

  const playersToChallenge = availablePlayers.filter((p) => p.nickname !== myNickname);

  if (!myNickname) {
    return (
      <div className="min-h-screen bg-[#0b0f19] bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.2),rgba(255,255,255,0))] text-white flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-slate-900/40 border border-slate-800/80 backdrop-blur-md rounded-3xl p-8 shadow-2xl flex flex-col gap-6">
          <div className="text-center flex flex-col items-center gap-2">
            <div className="bg-violet-600/10 p-3 rounded-2xl border border-violet-500/20">
              <Trophy className="h-10 w-10 text-violet-500 animate-pulse" />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-violet-400 to-indigo-300 bg-clip-text text-transparent">
              chess-rs multiplayer
            </h1>
            <p className="text-sm text-slate-450 leading-relaxed">
              {translations[lang].subtitle}
            </p>
          </div>
          
          <form onSubmit={handleClaimNickname} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {translations[lang].nicknameLabel}
              </label>
              <input
                type="text"
                maxLength={15}
                value={nicknameInput}
                onChange={(e) => setNicknameInput(e.target.value)}
                placeholder={translations[lang].nicknamePlaceholder}
                className="px-4 py-3 bg-slate-950/85 border border-slate-800 rounded-xl text-sm focus:outline-none focus:border-violet-500 transition duration-150 text-slate-100 placeholder-slate-650"
              />
              {nicknameError && (
                <span className="text-xs text-rose-500 font-medium">
                  {nicknameError}
                </span>
              )}
            </div>
            <button
              type="submit"
              disabled={!isConnected || !nicknameInput.trim()}
              className="py-3 bg-violet-600 hover:bg-violet-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold rounded-xl text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-violet-600/25 cursor-pointer disabled:cursor-not-allowed"
            >
              {translations[lang].nicknameButton}
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
          
          <div className="flex items-center justify-between mt-2 pt-4 border-t border-slate-800/60 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
              <span>{isConnected ? translations[lang].connected : translations[lang].connecting}</span>
            </div>
            
            <div className="flex items-center gap-1.5 bg-slate-950/60 p-1 rounded-lg border border-slate-850">
              <button
                type="button"
                onClick={() => setLang('pt')}
                className={`px-2 py-1 rounded text-[10px] font-bold transition cursor-pointer ${lang === 'pt' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
              >
                PT 🇧🇷
              </button>
              <button
                type="button"
                onClick={() => setLang('en')}
                className={`px-2 py-1 rounded text-[10px] font-bold transition cursor-pointer ${lang === 'en' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
              >
                EN 🇺🇸
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      
      {/* Outgoing Challenge Wait Dialog */}
      {outgoingChallengeTo && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-md w-full mx-4 shadow-2xl text-center flex flex-col gap-6 animate-fade-in">
            <div className="w-10 h-10 border-4 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <div>
              <h3 className="text-lg font-bold text-white mb-2">{translations[lang].challengeSentTitle}</h3>
              <p className="text-sm text-slate-405 font-medium">
                {translations[lang].challengeSentWait.replace("{name}", outgoingChallengeTo)}
              </p>
            </div>
            <button
              onClick={() => setOutgoingChallengeTo(null)}
              className="py-2 px-4 bg-slate-850 hover:bg-slate-800 text-slate-350 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              {translations[lang].cancel}
            </button>
          </div>
        </div>
      )}

      {/* Endgame Modal Overlay */}
      {isGameOver && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-md w-full mx-4 shadow-2xl text-center flex flex-col gap-6">
            <div className="bg-yellow-500/10 p-4 rounded-full border border-yellow-500/30 w-fit mx-auto">
              <Trophy className="h-12 w-12 text-yellow-500 animate-bounce" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-white mb-2">{translations[lang].gameOver}</h3>
              <p className="text-sm text-slate-400 font-medium">
                {getGameOverReason()}
              </p>
            </div>
            <button
              onClick={handleRequestRematch}
              className="py-3 px-6 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-bold shadow-lg shadow-violet-600/20 transition duration-200 cursor-pointer"
            >
              {translations[lang].rematch}
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-violet-600/10 p-2 rounded-lg border border-violet-500/30">
              <Trophy className="h-6 w-6 text-violet-500" />
            </div>
            <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
              chess-rs
            </span>
          </div>

          <div className="flex items-center gap-4">
            {myNickname && (
              <span className="text-xs font-semibold text-slate-450">
                {translations[lang].loggedAs}: <strong className="text-violet-400 font-bold">{myNickname}</strong>
              </span>
            )}
            
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border ${
              isConnected 
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
            }`}>
              {isConnected ? (
                <>
                  <Wifi className="h-3.5 w-3.5 animate-pulse" />
                  <span>{translations[lang].connectedStatus}</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-3.5 w-3.5" />
                  <span>{translations[lang].disconnectedStatus}</span>
                </>
              )}
            </div>
            
            <div className="flex items-center gap-1 bg-slate-900 border border-slate-800/80 px-3 py-1.5 rounded-full text-xs font-semibold text-slate-400">
              <span>{lang === 'pt' ? 'PT-BR 🇧🇷' : 'EN 🇺🇸'}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col lg:flex-row gap-8 items-stretch">
        
        {isInLobby ? (
          /* Lobby view */
          <div className="flex-1 flex flex-col lg:flex-row gap-8 items-stretch w-full">
            
            {/* Left Column: Saguão / Available players */}
            <div className="flex-1 bg-slate-900/40 border border-slate-900 rounded-2xl p-6 shadow-2xl backdrop-blur-sm flex flex-col gap-6">
              <div>
                <h2 className="text-lg font-bold text-white mb-1">{translations[lang].lobbyTitle}</h2>
                <p className="text-xs text-slate-450">{translations[lang].lobbySubtitle}</p>
              </div>

              {/* Incoming challenge invitation popup banner */}
              {incomingChallenge && (
                <div className="bg-violet-650/20 border border-violet-500/30 p-4 rounded-xl flex items-center justify-between animate-pulse">
                  <div className="flex items-center gap-2">
                    <User className="h-4.5 w-4.5 text-violet-400" />
                    <span className="text-sm font-semibold text-slate-100">
                      <strong className="text-violet-400">{incomingChallenge.from_nickname}</strong> {translations[lang].challengeReceived}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleAcceptChallenge}
                      className="px-3.5 py-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-xs font-bold transition shadow-md shadow-violet-600/10 cursor-pointer"
                    >
                      {translations[lang].accept}
                    </button>
                    <button
                      onClick={handleDeclineChallenge}
                      className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-lg text-xs font-bold transition cursor-pointer"
                    >
                      {translations[lang].decline}
                    </button>
                  </div>
                </div>
              )}

              {/* Available lobby players list */}
              <div className="flex-1 overflow-y-auto min-h-[340px] flex flex-col gap-2.5 pr-1">
                {playersToChallenge.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-500 italic text-sm gap-2">
                    <User className="h-10 w-10 text-slate-800 mb-2" />
                    <span>{translations[lang].lobbyEmpty}</span>
                    <span className="text-xs text-slate-600 max-w-[280px]">
                      {translations[lang].lobbyEmptySub}
                    </span>
                  </div>
                ) : (
                  playersToChallenge.map((player) => (
                    <div
                      key={player.conn_id}
                      className="flex items-center justify-between p-4 bg-slate-950/45 border border-slate-900 rounded-xl hover:border-slate-850 transition duration-150"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="font-semibold text-slate-200">{player.nickname}</span>
                      </div>
                      <button
                        onClick={() => handleSendChallenge(player.nickname)}
                        disabled={outgoingChallengeTo !== null}
                        className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:bg-slate-855 disabled:text-slate-650 text-white rounded-xl text-xs font-bold transition shadow-md shadow-violet-600/10 cursor-pointer disabled:cursor-not-allowed"
                      >
                        {translations[lang].challenge}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Right Column: Saguão Global Chat */}
            <div className="w-full lg:w-96 flex flex-col gap-6">
              <div className="flex-1 bg-slate-900/60 border border-slate-900 rounded-2xl p-6 flex flex-col shadow-xl min-h-[440px]">
                <h3 className="text-sm font-semibold text-slate-350 uppercase tracking-wider mb-4">
                  {translations[lang].lobbyChat}
                </h3>
                
                <div 
                  ref={consoleEndRef}
                  className="flex-1 overflow-y-auto p-4 bg-slate-950/70 border border-slate-850 rounded-xl flex flex-col gap-3 max-h-[300px]"
                >
                  {chatMessages.length === 0 ? (
                    <div className="text-slate-600 italic text-center py-8 text-xs my-auto">
                      {translations[lang].lobbyChatEmpty}
                    </div>
                  ) : (
                    chatMessages.map((msg, idx) => (
                      <div key={idx} className="text-xs leading-relaxed break-words">
                        {msg.isSystem ? (
                          <div className="text-violet-400 font-semibold italic bg-violet-500/5 px-2.5 py-1 rounded border border-violet-500/10 text-center">
                            {msg.message}
                          </div>
                        ) : (
                          <div className="flex flex-col bg-slate-950/40 p-2.5 rounded-lg border border-slate-900/50">
                            <span className="font-bold text-violet-450 mb-0.5">{msg.sender}</span>
                            <span className="text-slate-300">{msg.message}</span>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
                
                <div className="flex gap-2 mt-4">
                  <input
                    type="text"
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    placeholder={translations[lang].lobbyChatPlaceholder}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendTestMessage()}
                    className="flex-1 px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-violet-500 transition"
                  />
                  <button
                    onClick={handleSendTestMessage}
                    className="p-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl transition cursor-pointer"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Match View */
          <div className="flex-1 flex flex-col lg:flex-row gap-8 items-stretch w-full">
            
            {/* Left Column: Board and Player representation */}
            <div className="flex-1 flex flex-col items-center justify-center bg-slate-900/40 border border-slate-900 rounded-2xl p-6 shadow-2xl backdrop-blur-sm relative">
              
              {/* Opponent player */}
              <div className="w-full max-w-[480px] mb-3 flex items-center justify-between bg-slate-950/45 border border-slate-900/50 rounded-xl px-4 py-2 text-xs">
                <div className="flex items-center gap-2">
                  <div className="bg-slate-800/80 w-6 h-6 rounded-md flex items-center justify-center font-bold text-[10px]">
                    {playerColor === 'black' ? 'W' : 'B'}
                  </div>
                  <span className="font-semibold text-slate-350">
                    {opponentNickname || translations[lang].oponente}
                  </span>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 text-[13px] text-slate-400 font-bold border-r border-slate-850 pr-3">
                    {playerColor === 'black' ? (
                      <>
                        {capturedByWhite.map((p, idx) => <span key={idx} className="text-slate-950 drop-shadow-[0_1px_1px_rgba(255,255,255,0.15)]">{unicodeSymbols[p]}</span>)}
                        {materialDiff > 0 && <span className="text-[10px] text-emerald-400 pl-1">+{materialDiff}</span>}
                      </>
                    ) : (
                      <>
                        {capturedByBlack.map((p, idx) => <span key={idx} className="text-slate-100">{unicodeSymbols[p]}</span>)}
                        {materialDiff < 0 && <span className="text-[10px] text-emerald-400 pl-1">+{Math.abs(materialDiff)}</span>}
                      </>
                    )}
                  </div>
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold font-mono border ${
                    (playerColor === 'black' ? isWhiteActive : isBlackActive)
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 animate-pulse'
                      : 'bg-slate-950/80 border-slate-900 text-slate-500'
                  }`}>
                    <Clock className="h-3 w-3" />
                    <span>{formatTime(playerColor === 'black' ? whiteTime : blackTime)}</span>
                  </div>
                </div>
              </div>

              {/* Chessboard Container */}
              <div className="w-full max-w-[480px] aspect-square rounded-lg overflow-hidden shadow-2xl border-4 border-slate-800 relative">
                <Chessboard 
                  options={{
                    position: gameFen,
                    onPieceDrop: onPieceDrop,
                    boardOrientation: playerColor === 'black' ? 'black' : 'white',
                    squareStyles: getCustomSquareStyles(),
                    boardStyle: {
                      borderRadius: '4px',
                      boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.5)',
                    },
                    darkSquareStyle: { backgroundColor: '#706677' },
                    lightSquareStyle: { backgroundColor: '#ede6f2' }
                  }}
                />

                {/* Waiting for Opponent Overlay */}
                {!hasOpponent && (
                  <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm flex flex-col items-center justify-center text-center p-6 gap-6 z-40">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-10 h-10 border-4 border-violet-500 border-t-transparent rounded-full animate-spin mb-2" />
                      <h3 className="text-base font-bold text-white">{translations[lang].waitingOpponent}</h3>
                      <p className="text-[11px] text-slate-450 max-w-[280px]">
                        {translations[lang].waitingOpponentDesc}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Self player */}
              <div className="w-full max-w-[480px] mt-3 flex items-center justify-between bg-slate-950/45 border border-slate-900/50 rounded-xl px-4 py-2 text-xs">
                <div className="flex items-center gap-2">
                  <div className="bg-slate-800/80 w-6 h-6 rounded-md flex items-center justify-center font-bold text-[10px]">
                    {playerColor === 'black' ? 'B' : 'W'}
                  </div>
                  <span className="font-semibold text-slate-200">
                    {myNickname} ({translations[lang].you})
                  </span>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 text-[13px] font-bold border-r border-slate-850 pr-3">
                    {playerColor === 'black' ? (
                      <>
                        {capturedByBlack.map((p, idx) => <span key={idx} className="text-slate-100">{unicodeSymbols[p]}</span>)}
                        {materialDiff < 0 && <span className="text-[10px] text-emerald-400 pl-1">+{Math.abs(materialDiff)}</span>}
                      </>
                    ) : (
                      <>
                        {capturedByWhite.map((p, idx) => <span key={idx} className="text-slate-955 drop-shadow-[0_1px_1px_rgba(255,255,255,0.15)]">{unicodeSymbols[p]}</span>)}
                        {materialDiff > 0 && <span className="text-[10px] text-emerald-400 pl-1">+{materialDiff}</span>}
                      </>
                    )}
                  </div>
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold font-mono border ${
                    (playerColor === 'black' ? isBlackActive : isWhiteActive)
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 animate-pulse'
                      : 'bg-slate-950/80 border-slate-900 text-slate-500'
                  }`}>
                    <Clock className="h-3 w-3" />
                    <span>{formatTime(playerColor === 'black' ? blackTime : whiteTime)}</span>
                  </div>
                </div>
              </div>
              
              {/* Game Alerts */}
              <div className="w-full max-w-[480px] mt-4 flex items-center justify-between bg-slate-950/80 border border-slate-850 rounded-xl px-4 py-2.5">
                <div className="flex items-center gap-2 text-xs">
                  <User className="h-4 w-4 text-violet-400 animate-pulse" />
                  <span className="font-medium">
                    {translations[lang].turn}: <strong className="text-violet-400">{activeTurn}</strong>
                  </span>
                </div>
                {isCheck && !isGameOver && (
                  <span className="text-[10px] px-2 py-0.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded font-bold animate-pulse">
                    {translations[lang].check}
                  </span>
                )}
                {errorMessage && (
                  <span className="text-[10px] px-2 py-0.5 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded font-semibold max-w-[200px] truncate">
                    {errorMessage}
                  </span>
                )}
              </div>
            </div>

            {/* Right Column: Game Chat & Controls */}
            <div className="w-full lg:w-96 flex flex-col gap-6">
              
              {/* Active Match Info Panel */}
              <div className="bg-slate-900/60 border border-slate-900 rounded-2xl p-6 flex flex-col gap-4 shadow-xl">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-350 uppercase tracking-wider">
                    {translations[lang].activeMatch}
                  </h2>
                  <button
                    onClick={handleQuitGame}
                    className="px-3 py-1.5 bg-rose-605/10 hover:bg-rose-600/20 text-rose-450 rounded-lg text-xs font-bold transition cursor-pointer"
                  >
                    {translations[lang].abandonMatch}
                  </button>
                </div>
                <div className="text-xs text-slate-550">
                  {translations[lang].gameId}: <span className="font-mono text-violet-400 font-bold">{currentRoom}</span>
                </div>
              </div>

              {/* Move History */}
              {renderMoveHistory()}

              {/* Game Chat */}
              <div className="flex-1 min-h-[260px] bg-slate-900/60 border border-slate-900 rounded-2xl p-6 flex flex-col shadow-xl">
                <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Send className="h-4 w-4 text-violet-400" />
                  {translations[lang].matchChat}
                </h3>

                <div 
                  ref={consoleEndRef}
                  className="flex-1 overflow-y-auto bg-slate-950/50 border border-slate-900 rounded-xl p-4 text-xs flex flex-col gap-3 max-h-[160px] scroll-smooth"
                >
                  {chatMessages.length === 0 ? (
                    <div className="text-slate-600 italic text-center my-auto">
                      {translations[lang].matchChatEmpty}
                    </div>
                  ) : (
                    chatMessages.map((msg, i) => (
                      <div key={i} className={`flex flex-col ${msg.isSystem ? 'items-center text-[10px] text-slate-500 font-medium py-1 text-center' : ''}`}>
                        {msg.isSystem ? (
                          <span>{msg.message}</span>
                        ) : (
                          <>
                            <span className="font-bold text-violet-400">{msg.sender}</span>
                            <span className="text-slate-200 mt-0.5 break-words bg-slate-950/55 rounded-lg px-2.5 py-1.5 w-fit border border-slate-900">{msg.message}</span>
                          </>
                        )}
                      </div>
                    ))
                  )}
                </div>

                <form 
                  onSubmit={(e) => { e.preventDefault(); handleSendTestMessage(); }} 
                  className="flex gap-2 mt-4"
                >
                  <input 
                    type="text" 
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    placeholder={translations[lang].matchChatPlaceholder}
                    className="flex-1 px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-violet-500 transition"
                  />
                  <button 
                    type="submit"
                    className="p-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl transition cursor-pointer"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* QUIT COUNTDOWN MODAL OVERLAY */}
      {opponentQuitCountdown !== null && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl flex flex-col items-center gap-5">
            <div className="bg-rose-500/10 p-4 rounded-full border border-rose-500/20 text-rose-500">
              <Trophy className="h-12 w-12 text-rose-500 animate-bounce" />
            </div>
            <div className="flex flex-col gap-2">
              <h3 className="text-xl font-extrabold tracking-tight text-white">
                {translations[lang].victoryWO}
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                {translations[lang].victoryWODesc.replace("{name}", quitterName)}
              </p>
              <p className="text-xs text-slate-500">
                {translations[lang].victoryWOReturn.replace("{sec}", String(opponentQuitCountdown))}
              </p>
            </div>
            <button
              onClick={handleReturnToLobbyImmediately}
              className="w-full py-3 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm font-bold transition shadow-lg shadow-violet-600/20 cursor-pointer"
            >
              {translations[lang].victoryWOButton}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

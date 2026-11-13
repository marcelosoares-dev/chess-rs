import { useCallback, useEffect, useRef, useState } from 'react';
import type { ClientMessage, ServerMessage } from '../protocol';

export type ConnectionStatus = 'connecting' | 'open' | 'closed';

const MAX_BACKOFF_MS = 10_000;

function endpoint() {
  const scheme = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${scheme}//${window.location.host}/ws`;
}

export function useConnection(onMessage: (message: ServerMessage) => void) {
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const socketRef = useRef<WebSocket | null>(null);
  const handlerRef = useRef(onMessage);

  useEffect(() => {
    handlerRef.current = onMessage;
  });

  useEffect(() => {
    let attempt = 0;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;

    const open = () => {
      setStatus('connecting');
      const socket = new WebSocket(endpoint());
      socketRef.current = socket;

      socket.onopen = () => {
        attempt = 0;
        setStatus('open');
      };
      socket.onmessage = ({ data }) => {
        try {
          handlerRef.current(JSON.parse(data) as ServerMessage);
        } catch (error) {
          console.error('mensagem inválida do servidor', error);
        }
      };
      socket.onclose = () => {
        socketRef.current = null;
        if (disposed) return;
        setStatus('closed');
        retry = setTimeout(open, Math.min(1000 * 2 ** attempt++, MAX_BACKOFF_MS));
      };
    };

    open();
    return () => {
      disposed = true;
      clearTimeout(retry);
      socketRef.current?.close();
    };
  }, []);

  const send = useCallback((message: ClientMessage) => {
    const socket = socketRef.current;
    if (socket?.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify(message));
    return true;
  }, []);

  return { status, send };
}

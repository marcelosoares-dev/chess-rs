import { AnimatePresence, motion } from 'framer-motion';
import { useEffect } from 'react';

interface Props {
  id: number | null;
  text: string | null;
  onDismiss: () => void;
}

const LIFETIME_MS = 4000;

export function Toast({ id, text, onDismiss }: Props) {
  useEffect(() => {
    if (id === null) return;
    const timer = setTimeout(onDismiss, LIFETIME_MS);
    return () => clearTimeout(timer);
  }, [id, onDismiss]);

  return (
    <AnimatePresence>
      {text && (
        <motion.div
          key={id}
          className="toast"
          role="status"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}
        >
          {text}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

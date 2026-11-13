import { AnimatePresence, motion } from 'framer-motion';
import type { ReactNode } from 'react';

interface Props {
  open: boolean;
  title: string;
  children?: ReactNode;
  actions: ReactNode;
  icon?: ReactNode;
}

const EASE = [0.2, 0.8, 0.2, 1] as const;

export function Dialog({ open, title, children, actions, icon }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="scrim"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className="dialog"
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.28, ease: EASE }}
          >
            {icon}
            <h2 className="dialog__title">{title}</h2>
            {children && <div className="dialog__body">{children}</div>}
            <div className="dialog__actions">{actions}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

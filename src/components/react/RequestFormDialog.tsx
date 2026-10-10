import { useEffect, useRef, useState } from 'react';
import { trackGoal } from '../../lib/analytics/track';
import RequestForm from './RequestForm';
import styles from './RequestFormDialog.module.css';

/**
 * The site-wide "Оставьте заявку" popup. Any element with
 * `data-request-form` opens it (header CTA and every content button that was
 * a dead href="#" on WP), so static Astro markup needs no React wrapper.
 * Native <dialog>: focus trap, Esc and inert background come for free.
 */
export default function RequestFormDialog() {
  const ref = useRef<HTMLDialogElement>(null);
  const [key, setKey] = useState(0);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const trigger = (e.target as Element | null)?.closest?.('[data-request-form]');
      if (!trigger) return;
      e.preventDefault();
      setKey((k) => k + 1); // fresh form on every open
      ref.current?.showModal();
      trackGoal('lead_form_open', { label: trigger.textContent?.trim() });
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  const close = () => ref.current?.close();

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby="request-dialog-title"
      onClick={(e) => {
        if (e.target === ref.current) close();
      }}
    >
      <div className={styles.panel}>
        <button type="button" className={styles.close} onClick={close} aria-label="Закрыть">
          ×
        </button>
        <h2 id="request-dialog-title" className={styles.title}>
          Оставьте заявку
        </h2>
        <p className={styles.lead}>Перезвоним и ответим на вопросы.</p>
        <RequestForm key={key} source="popup" onDone={close} />
      </div>
    </dialog>
  );
}

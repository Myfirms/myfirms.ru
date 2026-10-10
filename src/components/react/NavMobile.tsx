import { useEffect, useRef, useState } from 'react';
import type { NavItem } from '../../lib/data/nav';
import styles from './NavMobile.module.css';

interface Props {
  nav: NavItem[];
  topLinks: NavItem[];
}

/** Burger menu for < 1024px. Uses <dialog> for focus trapping and Esc. */
export default function NavMobile({ nav, topLinks }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  useEffect(() => {
    const d = ref.current;
    const onClose = () => document.documentElement.style.removeProperty('overflow');
    d?.addEventListener('close', onClose);
    return () => d?.removeEventListener('close', onClose);
  }, []);

  const open = () => {
    ref.current?.showModal();
    document.documentElement.style.overflow = 'hidden';
  };
  const close = () => ref.current?.close();

  return (
    <>
      <button type="button" className={styles.burger} onClick={open} aria-label="Открыть меню" aria-haspopup="dialog">
        <span />
        <span />
        <span />
      </button>
      <dialog ref={ref} className={styles.panel} aria-label="Меню">
        <div className={styles.head}>
          <button type="button" className={styles.close} onClick={close} aria-label="Закрыть меню">
            ×
          </button>
        </div>
        <nav aria-label="Мобильное меню">
          <ul className={styles.list}>
            <li>
              <a href="/">Главная</a>
            </li>
            {nav.map((item) =>
              item.children ? (
                <li key={item.href}>
                  <div className={styles.group}>
                    <a href={item.href}>{item.label}</a>
                    <button
                      type="button"
                      className={styles.toggle}
                      aria-expanded={openGroup === item.href}
                      aria-label={`Подменю: ${item.label}`}
                      onClick={() => setOpenGroup((g) => (g === item.href ? null : item.href))}
                    >
                      ▾
                    </button>
                  </div>
                  {openGroup === item.href && (
                    <ul className={styles.sub}>
                      {item.children.map((c) => (
                        <li key={c.href}>
                          <a href={c.href}>{c.label}</a>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ) : (
                <li key={item.href}>
                  <a href={item.href}>{item.label}</a>
                </li>
              ),
            )}
            {topLinks.map((l) => (
              <li key={l.href}>
                <a href={l.href}>{l.label}</a>
              </li>
            ))}
          </ul>
        </nav>
        <button
          type="button"
          className={styles.cta}
          onClick={() => {
            close();
            // Hand over to the site-wide RequestFormDialog listener.
            setTimeout(() => document.querySelector<HTMLElement>('[data-request-form]')?.click(), 0);
          }}
        >
          Оставить заявку
        </button>
      </dialog>
    </>
  );
}

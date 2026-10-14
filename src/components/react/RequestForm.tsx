import { useId, useState } from 'react';
import { submitLead } from '../../lib/adapters/leadIntakeAdapter';
import { trackGoal } from '../../lib/analytics/track';
import { validateRequestForm, type RequestFormFieldErrors, type RequestFormPayload, type RequestFormSource } from '../../lib/contracts/requestForm';
import { CONSENT_VERSION, legalLinks } from '../../lib/data/legal';
import styles from './RequestForm.module.css';

interface Props {
  source: RequestFormSource;
  /** Section form also asks for e-mail and a short task description (as on WP). */
  extended?: boolean;
  submitLabel?: string;
  onDone?: () => void;
}

type State = { kind: 'idle' } | { kind: 'sending' } | { kind: 'sent' } | { kind: 'error'; message: string };
type Field = 'name' | 'phone' | 'email' | 'message' | 'website';

export default function RequestForm({ source, extended = false, submitLabel = 'Отправить', onDone }: Props) {
  const id = useId();
  const [values, setValues] = useState<Record<Field, string>>({ name: '', phone: '', email: '', message: '', website: '' });
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<RequestFormFieldErrors>({});
  const [state, setState] = useState<State>({ kind: 'idle' });

  const set = (k: Field) => (e: { currentTarget: { value: string } }) => {
    const value = e.currentTarget.value;
    setValues((v) => ({ ...v, [k]: value }));
  };

  async function onSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    const found = validateRequestForm({ ...values, consent: consent || undefined } as Partial<RequestFormPayload>, extended);
    setErrors(found);
    if (Object.keys(found).length) return;
    setState({ kind: 'sending' });
    const payload: RequestFormPayload = {
      name: values.name.trim(),
      phone: values.phone.trim(),
      ...(extended && values.email.trim() && { email: values.email.trim() }),
      ...(extended && values.message.trim() && { message: values.message.trim() }),
      consent: true,
      consentVersion: CONSENT_VERSION,
      source,
      page: window.location.pathname,
      ...(values.website && { website: values.website }),
    };
    const result = await submitLead(payload);
    if (result.status === 'ok') {
      setState({ kind: 'sent' });
      trackGoal('lead_submit', { source });
    } else setState({ kind: 'error', message: result.message });
  }

  if (state.kind === 'sent') {
    return (
      <div className={styles.done} role="status">
        <p className={styles.doneTitle}>Спасибо! Заявка отправлена.</p>
        <p>Мы свяжемся с вами в ближайшее рабочее время.</p>
        {onDone && (
          <button type="button" className={styles.submit} onClick={onDone}>
            Закрыть
          </button>
        )}
      </div>
    );
  }

  const input = (name: 'name' | 'phone' | 'email', label: string, type: string, autoComplete: string) => (
    <div className={styles.field}>
      <label className="visually-hidden" htmlFor={`${id}-${name}`}>
        {label}
      </label>
      <input
        id={`${id}-${name}`}
        className={styles.input}
        type={type}
        name={name}
        placeholder={label}
        autoComplete={autoComplete}
        value={values[name]}
        onChange={set(name)}
        aria-invalid={errors[name] ? true : undefined}
        aria-describedby={errors[name] ? `${id}-${name}-err` : undefined}
      />
      {errors[name] && (
        <span id={`${id}-${name}-err`} className={styles.error}>
          {errors[name]}
        </span>
      )}
    </div>
  );

  return (
    <form className={styles.form} onSubmit={onSubmit} noValidate>
      {input('name', 'Ваше имя', 'text', 'name')}
      {extended && input('email', 'Ваш e-mail', 'email', 'email')}
      {input('phone', 'Ваш телефон', 'tel', 'tel')}
      {extended && (
        <div className={styles.field}>
          <label className="visually-hidden" htmlFor={`${id}-message`}>
            Коротко о вашей задаче и целях
          </label>
          <textarea
            id={`${id}-message`}
            className={styles.textarea}
            name="message"
            rows={4}
            placeholder="Коротко о вашей задаче и целях"
            value={values.message}
            onChange={set('message')}
          />
        </div>
      )}
      <div className={styles.honeypot} aria-hidden="true">
        <label>
          Сайт
          <input type="text" name="website" tabIndex={-1} autoComplete="off" value={values.website} onChange={set('website')} />
        </label>
      </div>
      <div className={styles.consent}>
        <input
          id={`${id}-consent`}
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.currentTarget.checked)}
          aria-invalid={errors.consent ? true : undefined}
          aria-describedby={errors.consent ? `${id}-consent-err` : undefined}
        />
        <label htmlFor={`${id}-consent`}>
          Я даю{' '}
          <a href={legalLinks.consent} target="_blank" rel="noopener">
            согласие на обработку персональных данных
          </a>{' '}
          и принимаю{' '}
          <a href={legalLinks.privacy} target="_blank" rel="noopener">
            политику обработки персональных данных
          </a>
        </label>
        {errors.consent && (
          <span id={`${id}-consent-err`} className={styles.error}>
            {errors.consent}
          </span>
        )}
      </div>
      {state.kind === 'error' && (
        <p className={styles.formError} role="alert">
          {state.message}
        </p>
      )}
      <button type="submit" className={styles.submit} disabled={state.kind === 'sending'}>
        {state.kind === 'sending' ? 'Отправляем…' : submitLabel}
      </button>
    </form>
  );
}

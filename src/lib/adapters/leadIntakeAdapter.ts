import type { RequestFormPayload, RequestFormSubmitResult } from '../contracts/requestForm';

const FAIL = 'Не удалось отправить заявку. Данные сохранены в форме — попробуйте ещё раз или напишите на info@myfirms.ru.';

/**
 * Posts to the lead-intake Lambda Function URL (lambda/lead-intake), which
 * emails the lead to it@myfirms.ru. PUBLIC_LEAD_ENDPOINT_URL unset is a hard
 * error, not a silent success — a form that pretends to send is worse than
 * a visible error.
 */
export async function submitLead(payload: RequestFormPayload): Promise<RequestFormSubmitResult> {
  const endpoint = import.meta.env.PUBLIC_LEAD_ENDPOINT_URL;
  if (!endpoint) return { status: 'error', message: FAIL };
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) return { status: 'error', message: FAIL };
    return (await response.json()) as RequestFormSubmitResult;
  } catch {
    return { status: 'error', message: FAIL };
  }
}

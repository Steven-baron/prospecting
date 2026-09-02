import { __ } from '../translation.js'

function csrfToken() {
  const t = window.csrf_token
  if (t && t !== '{{ csrf_token }}') return t
  return document.cookie.match(/csrf_token=([^;]+)/)?.[1] ?? ''
}

export async function call(method, args = {}) {
  const res = await fetch(`/api/method/${method}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Frappe-CSRF-Token': csrfToken(),
    },
    body: JSON.stringify(args),
  })
  const data = await res.json()
  if (data.exc_type || data.exc) {
    const msg = data.exc_type || JSON.parse(data.exc || '""') || __('API error')
    throw new Error(msg)
  }
  return data.message
}

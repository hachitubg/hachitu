export function json<T>(data: T, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...init.headers,
    },
  })
}

export function text(message: string, init: ResponseInit = {}): Response {
  return new Response(message, {
    ...init,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      ...init.headers,
    },
  })
}

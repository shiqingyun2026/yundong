const http = require('node:http')

const METHODS = new Set(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'])

const normalizePath = value => {
  if (!value) {
    return '/'
  }

  const normalized = `/${`${value}`.trim()}`.replace(/\/+/g, '/')
  return normalized.length > 1 && normalized.endsWith('/') ? normalized.slice(0, -1) : normalized
}

const joinPaths = (basePath, childPath) => {
  const base = normalizePath(basePath)
  const child = normalizePath(childPath)

  if (base === '/') {
    return child
  }

  if (child === '/') {
    return base
  }

  return normalizePath(`${base}/${child}`)
}

const compilePath = path => {
  const normalized = normalizePath(path)
  if (normalized === '/') {
    return {
      path: normalized,
      match(targetPath) {
        return targetPath === '/' ? {} : null
      },
      matchPrefix() {
        return true
      }
    }
  }

  const keys = []
  const escaped = normalized
    .split('/')
    .map(segment => {
      if (!segment) {
        return ''
      }

      if (segment.startsWith(':')) {
        keys.push(segment.slice(1))
        return '([^/]+)'
      }

      return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    })
    .join('/')

  const exact = new RegExp(`^${escaped}$`)

  return {
    path: normalized,
    match(targetPath) {
      const matched = exact.exec(targetPath)
      if (!matched) {
        return null
      }

      return keys.reduce((result, key, index) => {
        result[key] = decodeURIComponent(matched[index + 1] || '')
        return result
      }, {})
    },
    matchPrefix(targetPath) {
      return targetPath === normalized || targetPath.startsWith(`${normalized}/`)
    }
  }
}

const createHeadersObject = headers =>
  Array.from(headers.entries()).reduce((result, [key, value]) => {
    result[key.toLowerCase()] = value
    return result
  }, {})

const parseBody = async request => {
  const method = request.method.toUpperCase()
  if (method === 'GET' || method === 'HEAD') {
    return undefined
  }

  const contentType = `${request.headers.get('content-type') || ''}`.toLowerCase()
  const raw = await request.text()
  if (!raw) {
    return undefined
  }

  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(raw)
    } catch (error) {
      return undefined
    }
  }

  if (contentType.includes('application/x-www-form-urlencoded')) {
    return Object.fromEntries(new URLSearchParams(raw).entries())
  }

  return raw
}

const createResponseToolkit = () => {
  const headers = new Headers()

  return {
    sent: false,
    statusCode: 200,
    body: null,
    headers,
    status(code) {
      this.statusCode = code
      return this
    },
    set(name, value) {
      headers.set(name, value)
      return this
    },
    json(payload) {
      if (!headers.has('content-type')) {
        headers.set('content-type', 'application/json; charset=utf-8')
      }
      this.body = JSON.stringify(payload)
      this.sent = true
      return this
    },
    send(payload = '') {
      this.body = payload
      this.sent = true
      return this
    },
    end(payload = '') {
      return this.send(payload)
    },
    toResponse() {
      const bodylessStatus = new Set([101, 103, 204, 205, 304])
      const payload = bodylessStatus.has(this.statusCode) ? null : this.body
      return new Response(payload, {
        status: this.statusCode,
        headers
      })
    }
  }
}

const createRouter = () => {
  const stack = []

  const router = {
    __isMiniExpressRouter: true,
    stack,
    use(pathOrHandler, ...restHandlers) {
      const path = typeof pathOrHandler === 'string' ? normalizePath(pathOrHandler) : '/'
      const handlers = typeof pathOrHandler === 'string' ? restHandlers : [pathOrHandler, ...restHandlers]

      handlers.forEach(handler => {
        if (!handler) {
          return
        }

        if (handler.__isMiniExpressRouter) {
          handler.stack.forEach(layer => {
            const nextPath = joinPaths(path, layer.path)
            stack.push({
              ...layer,
              path: nextPath,
              matcher: compilePath(nextPath)
            })
          })
          return
        }

        stack.push({
          type: 'middleware',
          path,
          matcher: compilePath(path),
          handlers: [handler]
        })
      })

      return this
    }
  }

  METHODS.forEach(method => {
    router[method.toLowerCase()] = (path, ...handlers) => {
      const normalizedPath = normalizePath(path)
      stack.push({
        type: 'route',
        method,
        path: normalizedPath,
        matcher: compilePath(normalizedPath),
        handlers
      })
      return router
    }
  })

  router.fetch = async request => {
    const url = new URL(request.url)
    const path = normalizePath(url.pathname)

    if (request.method.toUpperCase() === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
          'access-control-allow-headers': 'Content-Type, Authorization'
        }
      })
    }

    const req = {
      method: request.method.toUpperCase(),
      url: request.url,
      path,
      query: Object.fromEntries(url.searchParams.entries()),
      headers: createHeadersObject(request.headers),
      body: await parseBody(request),
      params: {},
      raw: request
    }

    const res = createResponseToolkit()

    const pipeline = []

    stack.forEach(layer => {
      if (layer.type === 'middleware') {
        if (layer.matcher.matchPrefix(path)) {
          layer.handlers.forEach(handler => pipeline.push({ handler, params: {} }))
        }
        return
      }

      if (layer.method !== req.method) {
        return
      }

      const params = layer.matcher.match(path)
      if (params) {
        layer.handlers.forEach(handler => pipeline.push({ handler, params }))
      }
    })

    let index = -1
    const dispatch = async currentIndex => {
      if (currentIndex <= index) {
        throw new Error('next() called multiple times')
      }

      index = currentIndex
      const entry = pipeline[currentIndex]
      if (!entry) {
        if (!res.sent) {
          res.status(404).json({
            message: 'Not Found'
          })
        }
        return
      }

      req.params = entry.params || {}
      const maybePromise = entry.handler(req, res, () => dispatch(currentIndex + 1))
      if (maybePromise && typeof maybePromise.then === 'function') {
        await maybePromise
      }
    }

    await dispatch(0)

    if (!res.headers.has('access-control-allow-origin')) {
      res.headers.set('access-control-allow-origin', '*')
      res.headers.set('access-control-allow-headers', 'Content-Type, Authorization')
      res.headers.set('access-control-allow-methods', 'GET,POST,PUT,DELETE,OPTIONS')
    }

    return res.toResponse()
  }

  router.listen = (port, callback) => {
    const server = http.createServer(async (incomingMessage, serverResponse) => {
      const chunks = []

      for await (const chunk of incomingMessage) {
        chunks.push(chunk)
      }

      const body = chunks.length ? Buffer.concat(chunks) : undefined
      const host = incomingMessage.headers.host || `127.0.0.1:${port}`
      const request = new Request(`http://${host}${incomingMessage.url}`, {
        method: incomingMessage.method,
        headers: incomingMessage.headers,
        body: body && body.length ? body : undefined
      })

      const response = await router.fetch(request)

      serverResponse.statusCode = response.status
      response.headers.forEach((value, key) => {
        serverResponse.setHeader(key, value)
      })

      const arrayBuffer = await response.arrayBuffer()
      serverResponse.end(Buffer.from(arrayBuffer))
    })

    return server.listen(port, callback)
  }

  return router
}

function express() {
  return createRouter()
}

express.Router = () => createRouter()
express.json = () => (req, res, next) => next()
express.cors = () => (req, res, next) => next()

module.exports = express

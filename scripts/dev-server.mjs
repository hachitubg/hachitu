import { spawn } from 'node:child_process'
import net from 'node:net'

const PORT = Number(process.env.HACHITU_SERVER_PORT || 3001)
const HEALTH_URL = `http://127.0.0.1:${PORT}/api/health`

function waitForever() {
  const timer = setInterval(() => {}, 60_000)

  function shutdown(signal) {
    clearInterval(timer)
    console.log(`[hachitu-dev-server] received ${signal}, stop waiting on shared server`)
    process.exit(0)
  }

  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))
}

function canConnect(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: '127.0.0.1', port })

    socket.once('connect', () => {
      socket.end()
      resolve(true)
    })

    socket.once('error', () => {
      resolve(false)
    })
  })
}

async function isHachituServerRunning() {
  try {
    const response = await fetch(HEALTH_URL)
    if (!response.ok) {
      return await hasLegacyChatDiscoveryEndpoint()
    }

    const payload = await response.json()
    return payload?.name === 'hachitu-server'
  } catch {
    return await hasLegacyChatDiscoveryEndpoint()
  }
}

async function hasLegacyChatDiscoveryEndpoint() {
  try {
    const response = await fetch(
      `http://127.0.0.1:${PORT}/api/apps/chat-online/discoveries?kind=mixed&limit=1`,
    )

    if (!response.ok) {
      return false
    }

    const payload = await response.json()
    return (
      typeof payload?.kind === 'string' &&
      Array.isArray(payload?.discoveries)
    )
  } catch {
    return false
  }
}

async function main() {
  const occupied = await canConnect(PORT)

  if (occupied) {
    const isHachitu = await isHachituServerRunning()

    if (!isHachitu) {
      console.error(
        `[hachitu-dev-server] port ${PORT} is already in use by another process. ` +
          `Set HACHITU_SERVER_PORT to another port or stop that process first.`,
      )
      process.exit(1)
    }

    console.log(`[hachitu-dev-server] reuse existing HACHITU server on http://127.0.0.1:${PORT}`)
    waitForever()
    return
  }

  const child = spawn(process.execPath, ['server/index.mjs'], {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
  })

  process.on('SIGINT', () => {
    child.kill('SIGINT')
  })

  process.on('SIGTERM', () => {
    child.kill('SIGTERM')
  })

  child.on('exit', (code, signal) => {
    if (signal) {
      process.exit(0)
      return
    }
    process.exit(code ?? 0)
  })
}

await main()

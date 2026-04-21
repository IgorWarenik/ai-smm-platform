import 'dotenv/config'
import { buildApp } from './app'

const port = Number(process.env.PORT) || 3001
const host = process.env.HOST || '0.0.0.0'

function validateEnv(): void {
  const required = [
    'DATABASE_URL',
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
    'INTERNAL_API_TOKEN',
  ]
  const missing = required.filter((key) => !process.env[key]?.trim())

  if (missing.length > 0) {
    console.error(`Missing required environment variables: ${missing.join(', ')}`)
    process.exit(1)
  }
}

async function main() {
  validateEnv()
  const app = await buildApp()
  await app.listen({ port, host })
  console.log(`🚀 API running at http://${host}:${port}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

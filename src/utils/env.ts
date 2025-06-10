import 'dotenv/config'
const envList = {
  BOT_TOKEN: process.env.BOT_TOKEN,
  GUILD_ID: process.env.GUILD_ID,
}
function checkEnv(): void {
  console.log('---check environment variables---')
  const missingEnvKeys = Object.entries(envList)
    .map(([key, value]) => {
      if (!value) return key
      return undefined
    })
    .filter((key): key is string => key !== undefined)
  if (missingEnvKeys.length) {
    console.error(`Missing environment variables: ${missingEnvKeys.join(', ')}`)
    process.exit(1)
  }
  console.log('Success to check environment variables!!')
}
checkEnv()
export const env = Object.fromEntries(
  Object.entries(envList).map(([key, value]) => [key, value ?? '']),
) as { [key in keyof typeof envList]: string }

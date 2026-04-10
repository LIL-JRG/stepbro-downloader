import { cookies } from 'next/headers'
import { mkdir } from 'fs/promises'
import { join } from 'path'
import { homedir } from 'os'
import { v4 as uuid } from 'uuid'

export function getBaseDir(): string {
  return process.env.DOWNLOADS_DIR || join(homedir(), 'Downloads')
}

export async function getUserDir(): Promise<string> {
  const cookieStore = await cookies()
  let userId = cookieStore.get('ytdlp_uid')?.value
  if (!userId) {
    userId = uuid()
    cookieStore.set('ytdlp_uid', userId, {
      maxAge: 60 * 60 * 24 * 365,
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
    })
  }
  const dir = join(getBaseDir(), userId)
  await mkdir(dir, { recursive: true })
  return dir
}

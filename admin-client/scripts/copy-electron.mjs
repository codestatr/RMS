import { cp, mkdir, rm } from 'node:fs/promises'

await rm('out/main', { recursive: true, force: true })
await rm('out/preload', { recursive: true, force: true })
await rm('out/sync', { recursive: true, force: true })
await rm('out/db', { recursive: true, force: true })
await mkdir('out/main', { recursive: true })
await mkdir('out/preload', { recursive: true })
await mkdir('out/sync', { recursive: true })
await mkdir('out/db', { recursive: true })
await cp('src/main/main.js', 'out/main/main.js')
await cp('src/preload/preload.cjs', 'out/preload/preload.cjs')
await cp('src/sync', 'out/sync', { recursive: true })
await cp('src/db', 'out/db', { recursive: true })

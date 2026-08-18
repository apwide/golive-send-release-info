import { sendReleaseInfo } from '@apwide/golive-github-actions'

console.log('BEFORE sendReleaseInfo call')

await sendReleaseInfo()

console.log('AFTER sendReleaseInfo call')

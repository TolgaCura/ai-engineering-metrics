import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

function getKey() {
  const hex = process.env.ENCRYPTION_KEY
  if (!hex || hex.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes)')
  }
  return Buffer.from(hex, 'hex')
}

/** Encrypts a plaintext string. Returns "iv:authTag:ciphertext" (all hex). */
export function encrypt(plaintext) {
  const key = getKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`
}

/** Decrypts a string produced by encrypt(). Returns the original plaintext. */
export function decrypt(stored) {
  const [ivHex, authTagHex, ciphertextHex] = stored.split(':')
  const key = getKey()
  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  const ciphertext = Buffer.from(ciphertextHex, 'hex')
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(authTag)
  return decipher.update(ciphertext, undefined, 'utf8') + decipher.final('utf8')
}

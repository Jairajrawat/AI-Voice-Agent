import crypto from 'crypto';

import { env } from '../config/env-config';

/**
 * Encryption Service for sensitive data
 * Uses AES-256-GCM for encryption with authentication
 */
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer;

  constructor() {
    const masterKey = env.MASTER_ENCRYPTION_KEY;
    if (!masterKey || masterKey.length < 32) {
      throw new Error('MASTER_ENCRYPTION_KEY must be at least 32 characters long');
    }
    // Derive a 32-byte key from the master key using SHA-256
    this.key = crypto.createHash('sha256').update(masterKey).digest();
  }

  /**
   * Encrypts data using AES-256-GCM
   * @param data - The string data to encrypt
   * @returns Encrypted data as base64 string (format: iv:authTag:ciphertext)
   */
  encrypt(data: string): string {
    try {
      // Generate a random initialization vector (16 bytes)
      const iv = crypto.randomBytes(16);

      // Create cipher
      const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);

      // Encrypt the data
      let encrypted = cipher.update(data, 'utf8', 'base64');
      encrypted += cipher.final('base64');

      // Get authentication tag
      const authTag = cipher.getAuthTag();

      // Combine iv + authTag + encrypted data
      const result = `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;

      return result;
    } catch (error) {
      throw new Error(`Encryption failed: ${(error as Error).message}`);
    }
  }

  /**
   * Decrypts data using AES-256-GCM
   * @param encryptedData - The encrypted data string (format: iv:authTag:ciphertext)
   * @returns Decrypted string
   */
  decrypt(encryptedData: string): string {
    try {
      // Split the encrypted data into components
      const [ivBase64, authTagBase64, encrypted] = encryptedData.split(':');

      if (!ivBase64 || !authTagBase64 || !encrypted) {
        throw new Error('Invalid encrypted data format');
      }

      // Convert back from base64
      const iv = Buffer.from(ivBase64, 'base64');
      const authTag = Buffer.from(authTagBase64, 'base64');

      // Create decipher
      const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
      decipher.setAuthTag(authTag);

      // Decrypt the data
      let decrypted = decipher.update(encrypted, 'base64', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      throw new Error(`Decryption failed: ${(error as Error).message}`);
    }
  }

  /**
   * Encrypts an object by converting it to JSON first
   * @param data - The object to encrypt
   * @returns Encrypted data as base64 string
   */
  encryptObject<T>(data: T): string {
    return this.encrypt(JSON.stringify(data));
  }

  /**
   * Decrypts data and parses it as JSON
   * @param encryptedData - The encrypted data string
   * @returns Parsed object
   */
  decryptObject<T>(encryptedData: string): T {
    const decrypted = this.decrypt(encryptedData);
    return JSON.parse(decrypted) as T;
  }
}

// Export singleton instance
export const encryptionService = new EncryptionService();

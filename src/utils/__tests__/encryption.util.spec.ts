import { describe, expect, it } from 'vitest';

import { EncryptionService } from '../encryption.util';

// Mock environment for testing
process.env.MASTER_ENCRYPTION_KEY = 'test-encryption-key-that-is-32-characters-long';

describe('EncryptionService', () => {
  const encryptionService = new EncryptionService();

  describe('encrypt', () => {
    it('should encrypt a string successfully', () => {
      const data = 'sensitive-data-123';
      const encrypted = encryptionService.encrypt(data);

      expect(encrypted).toBeDefined();
      expect(encrypted).not.toBe(data);
      expect(encrypted.split(':')).toHaveLength(3); // iv:authTag:ciphertext
    });

    it('should produce different ciphertext for same input', () => {
      const data = 'same-data';
      const encrypted1 = encryptionService.encrypt(data);
      const encrypted2 = encryptionService.encrypt(data);

      expect(encrypted1).not.toBe(encrypted2);
    });
  });

  describe('decrypt', () => {
    it('should decrypt encrypted data correctly', () => {
      const data = 'secret-api-key-abc123';
      const encrypted = encryptionService.encrypt(data);
      const decrypted = encryptionService.decrypt(encrypted);

      expect(decrypted).toBe(data);
    });

    it('should handle complex objects when encrypted as JSON', () => {
      const data = {
        exotelApiKey: 'test-key',
        exotelApiToken: 'test-token',
        deepgramApiKey: 'deepgram-key',
      };

      const encrypted = encryptionService.encrypt(JSON.stringify(data));
      const decrypted = JSON.parse(encryptionService.decrypt(encrypted));

      expect(decrypted).toEqual(data);
    });

    it('should throw error for invalid encrypted format', () => {
      expect(() => encryptionService.decrypt('invalid-format')).toThrow(
        'Invalid encrypted data format',
      );
    });

    it('should throw error for tampered data', () => {
      const data = 'test-data';
      const encrypted = encryptionService.encrypt(data);
      const tampered = encrypted.substring(0, encrypted.length - 5) + 'xxxxx';

      expect(() => encryptionService.decrypt(tampered)).toThrow();
    });
  });

  describe('encryptObject / decryptObject', () => {
    it('should encrypt and decrypt objects', () => {
      const data = {
        sttProvider: 'deepgram',
        apiKey: 'test-key',
        config: { language: 'en-IN' },
      };

      const encrypted = encryptionService.encryptObject(data);
      const decrypted = encryptionService.decryptObject<typeof data>(encrypted);

      expect(decrypted).toEqual(data);
    });
  });
});

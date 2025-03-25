import { initializeSecureStorage, securelyStoreFile, validateStoredFile, securelyDeleteFile } from '../../lib/secureFileHandling';
import { mkdir, writeFile, chmod, access, constants, unlink, stat } from 'fs/promises';
import { join } from 'path';
import crypto from 'crypto';

jest.mock('fs/promises');
jest.mock('crypto');

describe('Secure File Handling Module Tests', () => {
  const mockMkdir = mkdir as jest.MockedFunction<typeof mkdir>;
  const mockWriteFile = writeFile as jest.MockedFunction<typeof writeFile>;
  const mockChmod = chmod as jest.MockedFunction<typeof chmod>;
  const mockAccess = access as jest.MockedFunction<typeof access>;
  const mockUnlink = unlink as jest.MockedFunction<typeof unlink>;
  const mockStat = stat as jest.MockedFunction<typeof stat>;
  const mockCreateHash = jest.spyOn(crypto, 'createHash');
  const mockRandomBytes = jest.spyOn(crypto, 'randomBytes');

  beforeEach(() => {
    jest.resetModules();
    mockMkdir.mockResolvedValue();
    mockWriteFile.mockResolvedValue();
    mockChmod.mockResolvedValue();
    mockUnlink.mockResolvedValue();
    mockCreateHash.mockReturnValue({
      update: jest.fn().mockReturnThis(),
      digest: jest.fn().mockReturnValue('test-hash')
    } as any);
    (mockRandomBytes as jest.MockedFunction<typeof crypto.randomBytes>).mockReturnValue(Buffer.from('random-bytes'));
  });

  describe('initializeSecureStorage', () => {
    test('should create storage directory if it does not exist', async () => {
      mockAccess.mockRejectedValueOnce(new Error('ENOENT'));

      await initializeSecureStorage();

      expect(mockMkdir).toHaveBeenCalledWith(expect.any(String), {
        recursive: true,
        mode: 0o700
      });
      expect(mockChmod).toHaveBeenCalledWith(expect.any(String), 0o700);
    });

    test('should set permissions if directory exists', async () => {
      mockAccess.mockResolvedValueOnce();

      await initializeSecureStorage();

      expect(mockMkdir).not.toHaveBeenCalled();
      expect(mockChmod).toHaveBeenCalledWith(expect.any(String), 0o700);
    });
  });

  describe('securelyStoreFile', () => {
    const testMetadata = {
      originalName: 'test.pdf',
      mimeType: 'application/pdf',
      size: 1024
    };

    test('should store file and metadata securely', async () => {
      const testBuffer = new ArrayBuffer(1024);

      const result = await securelyStoreFile(testBuffer, testMetadata);

      expect(result.isValid).toBe(true);
      expect(result.securityLevel).toBe('LOW');
      expect(result.fileHash).toBe('test-hash');
      expect(mockWriteFile).toHaveBeenCalledTimes(2);
      expect(mockWriteFile).toHaveBeenCalledWith(
        expect.stringContaining('test-hash.pdf'),
        expect.any(Buffer),
        { mode: 0o600 }
      );
    });

    test('should handle storage errors', async () => {
      mockWriteFile.mockRejectedValueOnce(new Error('Write failed'));

      const testBuffer = new ArrayBuffer(1024);
      const result = await securelyStoreFile(testBuffer, testMetadata);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Failed to securely store file');
      expect(result.securityLevel).toBe('CRITICAL');
    });
  });

  describe('validateStoredFile', () => {
    const testHash = 'test-hash';

    test('should validate file with correct permissions', async () => {
      mockAccess.mockResolvedValue();
      mockStat.mockResolvedValue({
        mode: 0o600,
        isFile: () => true
      } as any);

      const result = await validateStoredFile(testHash);

      expect(result.isValid).toBe(true);
      expect(result.securityLevel).toBe('LOW');
      expect(result.fileHash).toBe(testHash);
    });

    test('should reject if file not found', async () => {
      mockAccess.mockRejectedValueOnce(new Error('ENOENT'));

      const result = await validateStoredFile(testHash);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('File not found or incorrect permissions');
      expect(result.securityLevel).toBe('HIGH');
    });

    test('should reject if permissions are incorrect', async () => {
      mockAccess.mockResolvedValue();
      mockStat.mockResolvedValue({
        mode: 0o644,
        isFile: () => true
      } as any);

      const result = await validateStoredFile(testHash);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('File permissions have been modified');
      expect(result.securityLevel).toBe('CRITICAL');
    });
  });

  describe('securelyDeleteFile', () => {
    const testHash = 'test-hash';

    test('should securely delete file and metadata', async () => {
      const result = await securelyDeleteFile(testHash);

      expect(result.isValid).toBe(true);
      expect(result.securityLevel).toBe('LOW');
      expect(mockWriteFile).toHaveBeenCalledTimes(2);
      expect(mockUnlink).toHaveBeenCalledTimes(2);
    });

    test('should handle deletion errors', async () => {
      mockUnlink.mockRejectedValueOnce(new Error('Delete failed'));

      const result = await securelyDeleteFile(testHash);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Failed to securely delete file');
      expect(result.securityLevel).toBe('HIGH');
    });
  });
}); 
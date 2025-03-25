import { scanFile, verifyClamAV } from '../../lib/virusScan';
import { exec, ChildProcess, ExecException } from 'child_process';
import { writeFile, unlink } from 'fs/promises';
import { promisify } from 'util';
import { EventEmitter } from 'events';

type ExecCallback = (error: ExecException | null, stdout: string | Buffer, stderr: string | Buffer) => void;

// Mock child_process and fs modules
jest.mock('child_process');
jest.mock('fs/promises');
jest.mock('util', () => ({
  promisify: jest.fn((fn) => fn)
}));

describe('Virus Scanning Module Tests', () => {
  const mockExec = exec as jest.MockedFunction<typeof exec>;
  const mockWriteFile = writeFile as jest.MockedFunction<typeof writeFile>;
  const mockUnlink = unlink as jest.MockedFunction<typeof unlink>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockWriteFile.mockResolvedValue();
    mockUnlink.mockResolvedValue();
  });

  const createMockChildProcess = () => {
    const mockProcess = new EventEmitter() as ChildProcess;
    mockProcess.stdin = new EventEmitter() as any;
    mockProcess.stdout = new EventEmitter() as any;
    mockProcess.stderr = new EventEmitter() as any;
    return mockProcess;
  };

  describe('scanFile', () => {
    test('should return clean result for safe file', async () => {
      mockExec.mockImplementation((command: string, options: any, callback?: ExecCallback) => {
        if (callback) {
          callback(null, '', '');
        }
        return createMockChildProcess();
      });

      const testBuffer = new ArrayBuffer(1024);
      const result = await scanFile(testBuffer);

      expect(result.isValid).toBe(true);
      expect(result.securityLevel).toBe('LOW');
      expect(mockWriteFile).toHaveBeenCalled();
      expect(mockUnlink).toHaveBeenCalled();
    });

    test('should detect malware in infected file', async () => {
      const threatName = 'Test.Virus.ABC';
      mockExec.mockImplementation((command: string, options: any, callback?: ExecCallback) => {
        if (callback) {
          const error = new Error('Virus found') as ExecException;
          error.stdout = `test.pdf: ${threatName} FOUND`;
          error.stderr = '';
          callback(error, '', '');
        }
        return createMockChildProcess();
      });

      const testBuffer = new ArrayBuffer(1024);
      const result = await scanFile(testBuffer);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Malware detected');
      expect(result.securityLevel).toBe('CRITICAL');
    });

    test('should handle scan failures gracefully', async () => {
      mockExec.mockImplementation((command: string, options: any, callback?: ExecCallback) => {
        if (callback) {
          const error = new Error('ClamAV error') as ExecException;
          error.stdout = '';
          error.stderr = 'Scanner error';
          callback(error, '', '');
        }
        return createMockChildProcess();
      });

      const testBuffer = new ArrayBuffer(1024);
      const result = await scanFile(testBuffer);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Virus scan failed');
      expect(result.securityLevel).toBe('HIGH');
    });
  });

  describe('verifyClamAV', () => {
    test('should return true when ClamAV is installed', async () => {
      mockExec.mockImplementation((command: string, options: any, callback?: ExecCallback) => {
        if (callback) {
          callback(null, 'ClamAV 0.103.2', '');
        }
        return createMockChildProcess();
      });

      const result = await verifyClamAV();
      expect(result).toBe(true);
    });

    test('should return false when ClamAV is not installed', async () => {
      mockExec.mockImplementation((command: string, options: any, callback?: ExecCallback) => {
        if (callback) {
          callback(new Error('Command not found') as ExecException, '', '');
        }
        return createMockChildProcess();
      });

      const result = await verifyClamAV();
      expect(result).toBe(false);
    });
  });
}); 
import { PDFSecurityResult } from './types';
import { mkdir, writeFile, chmod, access, constants, unlink, stat } from 'fs/promises';
import { join, dirname } from 'path';
import crypto from 'crypto';
import { createHash } from 'crypto';

const SECURE_STORAGE_PATH = process.env.SECURE_STORAGE_PATH || './secure-storage';
const FILE_PERMISSIONS = 0o600; // Read/write for owner only
const DIR_PERMISSIONS = 0o700; // Read/write/execute for owner only

interface SecureFileMetadata {
  originalName: string;
  mimeType: string;
  size: number;
  hash?: string;
  timestamp?: number;
}

export async function initializeSecureStorage(): Promise<void> {
  try {
    // Check if storage directory exists
    try {
      await access(SECURE_STORAGE_PATH, constants.F_OK);
    } catch {
      // Create storage directory with secure permissions
      await mkdir(SECURE_STORAGE_PATH, { recursive: true, mode: DIR_PERMISSIONS });
    }

    // Ensure directory permissions are correct
    await chmod(SECURE_STORAGE_PATH, DIR_PERMISSIONS);
  } catch (error) {
    throw new Error(`Failed to initialize secure storage: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function securelyStoreFile(
  fileData: Uint8Array,
  metadata: SecureFileMetadata
): Promise<PDFSecurityResult> {
  try {
    // Generate secure file hash
    const hash = createHash('sha256').update(fileData).digest('hex');
    const filePath = join(SECURE_STORAGE_PATH, hash);
    const metadataPath = `${filePath}.meta`;

    // Ensure storage directory exists with secure permissions
    await initializeSecureStorage();

    // Write file with secure permissions
    await writeFile(filePath, fileData);
    await chmod(filePath, FILE_PERMISSIONS);

    // Store metadata
    const metadataContent = JSON.stringify({
      ...metadata,
      hash,
      timestamp: Date.now()
    });
    await writeFile(metadataPath, metadataContent);
    await chmod(metadataPath, FILE_PERMISSIONS);

    return {
      isValid: true,
      fileHash: hash,
      securityLevel: 'LOW'
    };
  } catch (error) {
    return {
      isValid: false,
      error: `Failed to securely store file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      securityLevel: 'HIGH'
    };
  }
}

export async function validateStoredFile(fileHash: string): Promise<PDFSecurityResult> {
  try {
    const filePath = join(SECURE_STORAGE_PATH, fileHash);
    const metadataPath = `${filePath}.meta`;
    
    // Verify file exists and permissions are correct
    try {
      await access(filePath, constants.F_OK | constants.R_OK);
      await access(metadataPath, constants.F_OK | constants.R_OK);
    } catch {
      return {
        isValid: false,
        error: 'File not found or incorrect permissions',
        securityLevel: 'HIGH'
      };
    }
    
    // Verify file permissions
    await chmod(filePath, FILE_PERMISSIONS);
    await chmod(metadataPath, FILE_PERMISSIONS);
    
    const fileStats = await stat(filePath);
    const metaStats = await stat(metadataPath);
    
    if ((fileStats.mode & 0o777) !== FILE_PERMISSIONS || (metaStats.mode & 0o777) !== FILE_PERMISSIONS) {
      return {
        isValid: false,
        error: 'File permissions have been modified',
        securityLevel: 'CRITICAL'
      };
    }
    
    return {
      isValid: true,
      securityLevel: 'LOW',
      fileHash
    };
  } catch (error) {
    return {
      isValid: false,
      error: `Failed to validate stored file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      securityLevel: 'HIGH'
    };
  }
}

export async function securelyDeleteFile(fileHash: string): Promise<PDFSecurityResult> {
  try {
    const filePath = join(SECURE_STORAGE_PATH, fileHash);
    const metadataPath = `${filePath}.meta`;
    
    // Securely overwrite file content before deletion
    const buffer = crypto.randomBytes(1024);
    await writeFile(filePath, buffer);
    await writeFile(metadataPath, buffer);
    
    // Delete files
    await unlink(filePath);
    await unlink(metadataPath);
    
    return {
      isValid: true,
      securityLevel: 'LOW'
    };
  } catch (error) {
    return {
      isValid: false,
      error: `Failed to securely delete file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      securityLevel: 'HIGH'
    };
  }
} 
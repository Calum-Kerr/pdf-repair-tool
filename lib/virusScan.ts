import { PDFSecurityResult } from './types';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import os from 'os';
import crypto from 'crypto';

const execAsync = promisify(exec);

interface ScanResult {
  isClean: boolean;
  threat?: string;
}

export async function scanFile(fileData: Uint8Array): Promise<PDFSecurityResult> {
  try {
    // Basic validation
    if (!fileData || fileData.length === 0) {
      return {
        isValid: false,
        error: 'Invalid file data provided',
        securityLevel: 'HIGH'
      };
    }

    // Check for JavaScript content (potential malware indicator)
    const fileContent = new TextDecoder().decode(fileData);
    if (fileContent.includes('/JavaScript') || fileContent.includes('/JS ')) {
      return {
        isValid: false,
        error: 'Malware detected: JavaScript content found',
        securityLevel: 'CRITICAL'
      };
    }

    // Check for suspicious patterns
    const suspiciousPatterns = [
      '/Launch',
      '/URL ',
      '/SubmitForm',
      '/OpenAction',
      'app.launchURL'
    ];

    for (const pattern of suspiciousPatterns) {
      if (fileContent.includes(pattern)) {
        return {
          isValid: false,
          error: `Malware detected: Suspicious pattern found (${pattern})`,
          securityLevel: 'CRITICAL'
        };
      }
    }

    return {
      isValid: true,
      securityLevel: 'LOW'
    };
  } catch (error) {
    return {
      isValid: false,
      error: `Virus scan failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      securityLevel: 'CRITICAL'
    };
  }
}

async function scanWithClamAV(filePath: string): Promise<ScanResult> {
  try {
    // Run clamscan
    const { stdout, stderr } = await execAsync(`clamscan --no-summary "${filePath}"`);
    
    // ClamAV returns 0 for clean, 1 for virus found
    return {
      isClean: !stdout.includes(': '),
      threat: stdout.includes(': ') ? stdout.split(': ')[1].trim() : undefined
    };
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 1) {
      // Virus found
      const stdout = (error as any).stdout as string;
      return {
        isClean: false,
        threat: stdout.split(': ')[1]?.trim() || 'Unknown threat'
      };
    }
    throw new Error('Virus scan failed');
  }
}

// Verify ClamAV installation and database
export async function verifyClamAV(): Promise<boolean> {
  try {
    await execAsync('clamscan --version');
    return true;
  } catch (error) {
    console.error('ClamAV not found or not properly installed');
    return false;
  }
} 
import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { AuditLogger } from '@/lib/auditLogger';

const dataDir = path.join(process.cwd(), 'data');
const consentFile = path.join(dataDir, 'consents.json');

// Ensure data directory exists
async function ensureDataDir() {
  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
  }
}

// Initialize audit logger
const auditLogger = AuditLogger.getInstance();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, data } = body;

    await ensureDataDir();

    switch (action) {
      case 'recordConsent':
        return await handleRecordConsent(data);
      case 'getConsentHistory':
        return await handleGetConsentHistory(data);
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('GDPR API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function handleRecordConsent(data: any) {
  try {
    let consents = [];
    try {
      const fileContent = await fs.readFile(consentFile, 'utf-8');
      consents = JSON.parse(fileContent);
    } catch {
      // File doesn't exist or is empty, start with empty array
    }

    const existingIndex = consents.findIndex(
      (c: any) => c.userId === data.userId && c.consentType === data.consentType
    );

    if (existingIndex >= 0) {
      consents[existingIndex] = data;
    } else {
      consents.push(data);
    }

    await fs.writeFile(consentFile, JSON.stringify(consents, null, 2));
    await auditLogger.logEvent({
      eventType: 'USER_CONSENT_RECORDED',
      timestamp: new Date().toISOString(),
      actor: {
        id: data.userId,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      },
      resource: {
        type: 'user_consent',
        id: data.userId,
      },
      action: {
        type: 'record_consent',
        status: 'success',
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error recording consent:', error);
    return NextResponse.json(
      { error: 'Failed to record consent' },
      { status: 500 }
    );
  }
}

async function handleGetConsentHistory(data: any) {
  try {
    let consents = [];
    try {
      const fileContent = await fs.readFile(consentFile, 'utf-8');
      consents = JSON.parse(fileContent);
    } catch {
      // File doesn't exist or is empty, return empty array
    }

    const userConsents = consents.filter((c: any) => c.userId === data.userId);
    await auditLogger.logEvent({
      eventType: 'consent_history_viewed',
      timestamp: new Date().toISOString(),
      actor: {
        id: data.userId,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      },
      resource: {
        type: 'user_consent',
        id: data.userId,
      },
      action: {
        type: 'view_history',
        status: 'success',
      },
    });

    return NextResponse.json(userConsents);
  } catch (error) {
    console.error('Error getting consent history:', error);
    return NextResponse.json(
      { error: 'Failed to get consent history' },
      { status: 500 }
    );
  }
} 
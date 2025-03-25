import { useState } from 'react';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Card, CardHeader, CardContent, CardTitle } from './ui/card';
import { GDPRCompliance, UserConsent } from '@/lib/gdprCompliance';
import { AuditLogger } from '@/lib/auditLogger';

interface ConsentManagerProps {
  userId: string;
  ipAddress: string;
  userAgent: string;
  onConsentChange?: (consent: UserConsent) => void;
}

type ConsentType = 'data_processing' | 'marketing' | 'analytics';

export function ConsentManager({
  userId,
  ipAddress,
  userAgent,
  onConsentChange
}: ConsentManagerProps) {
  const [consents, setConsents] = useState<Record<ConsentType, boolean>>({
    data_processing: false,
    marketing: false,
    analytics: false
  });

  const handleConsentChange = async (consentType: ConsentType, granted: boolean) => {
    try {
      const gdprService = GDPRCompliance.getInstance();
      
      const consent: UserConsent = {
        userId,
        consentType,
        granted,
        timestamp: new Date().toISOString(),
        ipAddress,
        userAgent
      };

      await gdprService.recordConsent(consent);
      setConsents(prev => ({ ...prev, [consentType]: granted }));
    } catch (error) {
      console.error('Failed to update consent:', error);
      // Revert the checkbox state on error
      setConsents(prev => ({ ...prev, [consentType]: !granted }));
    }
  };

  const handleRevokeAll = async () => {
    try {
      const gdprService = GDPRCompliance.getInstance();
      
      // Create an array of promises for each consent type
      const revokePromises = (Object.keys(consents) as ConsentType[]).map(consentType => {
        const consent: UserConsent = {
          userId,
          consentType,
          granted: false,
          timestamp: new Date().toISOString(),
          ipAddress,
          userAgent
        };
        return gdprService.recordConsent(consent);
      });

      // Wait for all revocations to complete
      await Promise.all(revokePromises);
      
      // Update all consents to false
      setConsents({
        data_processing: false,
        marketing: false,
        analytics: false
      });
    } catch (error) {
      console.error('Failed to revoke all consents:', error);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Data Processing Consent</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-500">
          Please review and provide your consent for different types of data processing.
        </p>
        
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="data_processing"
              checked={consents.data_processing}
              onCheckedChange={(checked: boolean) => handleConsentChange('data_processing', checked)}
            />
            <label htmlFor="data_processing" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              I consent to the processing of my data for service delivery
            </label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="marketing"
              checked={consents.marketing}
              onCheckedChange={(checked: boolean) => handleConsentChange('marketing', checked)}
            />
            <label htmlFor="marketing" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              I consent to receive marketing communications
            </label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="analytics"
              checked={consents.analytics}
              onCheckedChange={(checked: boolean) => handleConsentChange('analytics', checked)}
            />
            <label htmlFor="analytics" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              I consent to the collection of analytics data
            </label>
          </div>
        </div>

        <Button
          variant="destructive"
          className="mt-4"
          onClick={handleRevokeAll}
        >
          Revoke All
        </Button>
      </CardContent>
    </Card>
  );
} 
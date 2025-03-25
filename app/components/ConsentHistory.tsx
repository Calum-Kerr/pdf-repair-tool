import { useEffect, useState } from "react"
import { GDPRCompliance, UserConsent } from "@/lib/gdprCompliance"
import { AuditLogger } from "@/lib/auditLogger"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select"

interface ConsentHistoryProps {
  userId: string
}

export function ConsentHistory({ userId }: ConsentHistoryProps) {
  const [consents, setConsents] = useState<UserConsent[]>([])
  const [filter, setFilter] = useState<string>("all")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    const loadConsentHistory = async () => {
      try {
        const auditLogger = AuditLogger.getInstance()
        const gdprService = GDPRCompliance.getInstance()
        
        // Log the consent history view attempt
        await auditLogger.logEvent({
          eventType: 'consent_history_viewed',
          timestamp: new Date().toISOString(),
          actor: {
            id: userId,
            ipAddress: typeof window !== 'undefined' ? window.location.hostname : 'unknown',
            userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'unknown'
          },
          resource: {
            type: 'user_consent',
            id: userId
          },
          action: {
            type: 'view_history',
            status: 'success'
          }
        })

        const history = await gdprService.getConsentHistory(userId)
        
        if (mounted) {
          setConsents(history)
          setLoading(false)
        }
      } catch (err) {
        if (mounted) {
          const errorMessage = 'Failed to load consent history'
          setError(errorMessage)
          console.error(errorMessage, err)

          // Log the error
          const auditLogger = AuditLogger.getInstance()
          await auditLogger.logEvent({
            eventType: 'consent_history_error',
            timestamp: new Date().toISOString(),
            actor: {
              id: userId,
              ipAddress: typeof window !== 'undefined' ? window.location.hostname : 'unknown',
              userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'unknown'
            },
            resource: {
              type: 'user_consent',
              id: userId
            },
            action: {
              type: 'view_history',
              status: 'failure',
              details: err instanceof Error ? err.message : 'Unknown error'
            }
          })
        }
      }
    }

    loadConsentHistory()

    return () => {
      mounted = false
    }
  }, [userId])

  const filteredHistory = consents.filter((record) => {
    if (filter === "all") return true
    return record.consentType === filter
  })

  if (loading) {
    return <div>Loading consent history...</div>
  }

  if (error) {
    return <div className="text-red-500">{error}</div>
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Consent History</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="data_processing">Data Processing</SelectItem>
              <SelectItem value="marketing">Marketing</SelectItem>
              <SelectItem value="analytics">Analytics</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {filteredHistory.length === 0 ? (
          <p className="text-center text-gray-500">No consent history found</p>
        ) : (
          <div className="space-y-4">
            {filteredHistory.map((consent, index) => (
              <div key={index} className="border-b pb-4 last:border-0">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">{consent.consentType}</p>
                    <p className="text-sm text-gray-500">
                      {new Date(consent.timestamp).toLocaleString()}
                    </p>
                  </div>
                  <span className={`px-2 py-1 rounded text-sm ${
                    consent.granted ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                  }`}>
                    {consent.granted ? "Granted" : "Revoked"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
} 
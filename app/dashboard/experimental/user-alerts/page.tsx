import ConnectionMonitoringComponent from '@/components/user-alerts/connection-monitoring-settings'
import React from 'react'

const ConnectionMonitoringAlertsPage = () => {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Connection Monitoring Alerts</h1>
        <p className="text-muted-foreground">
          Configure alerts for connection monitoring to stay informed about
          connectivity issues through automated email notifications.
        </p>
      </div>
      <ConnectionMonitoringComponent />
    </div>
  )
}

export default ConnectionMonitoringAlertsPage
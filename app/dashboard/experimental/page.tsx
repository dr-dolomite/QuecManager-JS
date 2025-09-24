import React from 'react'
import NetworkInsights from './network-insights/page'
import RealtimeSpeedMonitor from '@/components/experimental/realtime-speed-monitor'

const ExperimentalPage = () => {
  return (
    <div className="space-y-6">
      <RealtimeSpeedMonitor />
      <NetworkInsights />
    </div>
  )
}

export default ExperimentalPage
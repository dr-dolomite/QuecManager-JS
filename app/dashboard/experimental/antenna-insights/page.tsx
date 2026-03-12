import SignalQualityComponent from '@/components/pages/signal-quality'
import React from 'react'

const AntennaInsightsPage = () => {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Antenna Signal Quality</h1>
        <p className="text-muted-foreground">
          Use this to reference your individual antenna connection's signal quality.
        </p>
      </div>
      <SignalQualityComponent />
    </div>
  )
}

export default AntennaInsightsPage
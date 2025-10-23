import React from 'react';
import { useBandwidthMonitor } from '@/hooks/use-bandwidth-monitor';

/**
 * Example component showing how to use the bandwidth monitor WebSocket connection.
 * This component displays real-time bandwidth data with 30-second historical tracking
 * received from ws://192.168.224.1:8838/bandwidth-monitor
 */
const BandwidthMonitorExample: React.FC = () => {
  const {
    historyData,
    isConnected,
    error,
    connectionStatus,
    reconnect,
    formatSpeed
  } = useBandwidthMonitor();

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Bandwidth Monitor</h1>
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <span className="text-sm font-medium">{connectionStatus}</span>
          {!isConnected && (
            <button
              onClick={reconnect}
              className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Reconnect
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-500 rounded-full flex-shrink-0"></div>
            <span className="text-red-800 font-medium">Error:</span>
          </div>
          <p className="text-red-700 mt-1">{error}</p>
        </div>
      )}

      {historyData ? (
        <div className="space-y-6">
          {/* Current Speeds */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Current Download Speed */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-blue-800">Current Download Speed</h3>
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              </div>
              <p className="text-2xl font-bold text-blue-600 mt-2">
                {formatSpeed(historyData.current.downloadSpeed)}
              </p>
            </div>

            {/* Current Upload Speed */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-green-800">Current Upload Speed</h3>
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              </div>
              <p className="text-2xl font-bold text-green-600 mt-2">
                {formatSpeed(historyData.current.uploadSpeed)}
              </p>
            </div>
          </div>

          {/* 30-Second Averages */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Average Download Speed */}
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-purple-800">Avg Download (30s)</h3>
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
              </div>
              <p className="text-xl font-bold text-purple-600 mt-2">
                {formatSpeed(historyData.averageDownloadSpeed)}
              </p>
            </div>

            {/* Average Upload Speed */}
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-orange-800">Avg Upload (30s)</h3>
                <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
              </div>
              <p className="text-xl font-bold text-orange-600 mt-2">
                {formatSpeed(historyData.averageUploadSpeed)}
              </p>
            </div>
          </div>

          {/* Peak Speeds */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Peak Download Speed */}
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-red-800">Peak Download (30s)</h3>
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
              </div>
              <p className="text-xl font-bold text-red-600 mt-2">
                {formatSpeed(historyData.maxDownloadSpeed)}
              </p>
            </div>

            {/* Peak Upload Speed */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-yellow-800">Peak Upload (30s)</h3>
                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
              </div>
              <p className="text-xl font-bold text-yellow-600 mt-2">
                {formatSpeed(historyData.maxUploadSpeed)}
              </p>
            </div>
          </div>

          {/* History Info */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-800 mb-3">Historical Data</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Data Points:</span>
                <span className="ml-2 font-mono font-medium">
                  {historyData.history.length}/30
                </span>
              </div>
              <div>
                <span className="text-gray-600">Last Update:</span>
                <span className="ml-2 font-mono text-xs">
                  {new Date(historyData.current.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <div>
                <span className="text-gray-600">WebSocket:</span>
                <span className="ml-2 font-mono text-xs">
                  ws://192.168.224.1:8838/bandwidth-monitor
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="w-12 h-12 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
            <div className={`w-6 h-6 rounded-full ${isConnected ? 'bg-blue-500' : 'bg-gray-400'}`}></div>
          </div>
          <p className="text-gray-600 text-lg">
            {isConnected ? 'Waiting for bandwidth data...' : 'Not connected to bandwidth monitor'}
          </p>
          <p className="text-gray-400 text-sm mt-2">
            Historical data will be available after collecting 30 seconds of measurements
          </p>
          <p className="text-gray-400 text-sm mt-1">
            WebSocket: ws://192.168.224.1:8838/bandwidth-monitor
          </p>
        </div>
      )}
    </div>
  );
};

export default BandwidthMonitorExample;
import NetworkInsights from "@/components/experimental/network-insights";

const NetworkInsightsPage = () => {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Network Insights</h1>
        <p className="text-muted-foreground">
          Real-time insights into your cellular network changes, including band
          switches, carrier aggregation events, and signal quality changes. The
          monitoring service runs automatically as part of QuecManager services.
        </p>
      </div>
      <NetworkInsights />
    </div>
  );
};

export default NetworkInsightsPage;

import InternetQuality from "@/components/experimental/internet-quality";
import React from "react";

const InternetQualityPage = () => {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">
          Internet Quality
        </h1>
        <p className="text-muted-foreground">
          Monitor and analyze the quality of your internet connection with
          real-time metrics.
        </p>
      </div>
      <InternetQuality />
    </div>
  );
};

export default InternetQualityPage;

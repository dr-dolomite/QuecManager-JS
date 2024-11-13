import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { HomeData } from "@/types/types";

interface DataTransmissionProps {
  data: HomeData | null;
  isLoading: boolean;
  bytesSent: string;
  bytesReceived: string;
}

const DataTransmission = ({
  data,
  isLoading,
  bytesSent,
  bytesReceived,
}: DataTransmissionProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Data Transmission</CardTitle>
        <CardDescription>Data transmission information</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        <div className="flex flex-row justify-between text-md">
          <p>Carrier Aggregation</p>
          {isLoading ? (
            <Skeleton className="h-4 w-[100px]" />
          ) : (
            <Badge
              className={`font-bold ${
                data?.dataTransmission.carrierAggregation === "Multi"
                  ? "bg-emerald-500 hover:bg-emerald-800"
                  : "bg-rose-500 hover:bg-rose-800"
              }`}
            >
              {data?.dataTransmission.carrierAggregation}
            </Badge>
          )}
        </div>

        <div className="flex flex-row justify-between text-md">
          <p>Bandwidth</p>
          {isLoading ? (
            <Skeleton className="h-4 w-[100px]" />
          ) : (
            <p className="font-bold">{data?.dataTransmission.bandwidth}</p>
          )}
        </div>

        <div className="flex flex-row justify-between text-md">
          <p>Connected Bands</p>
          {isLoading ? (
            <Skeleton className="h-4 w-[100px]" />
          ) : (
            <p className="font-bold">{data?.dataTransmission.connectedBands}</p>
          )}
        </div>

        <div className="flex flex-row justify-between text-md">
          <p>Signal Strength</p>
          {isLoading ? (
            <Skeleton className="h-4 w-[100px]" />
          ) : (
            // Use appropriate class for the signal strength badge
            // if > 80% use bg-emerald-500 hover:bg-emerald-800 if > 40% use bg-orange-500 else use bg-rose-500 hover:bg-rose-800
            <Badge
              className={`font-bold ${
                data?.dataTransmission.signalStrength &&
                parseInt(data?.dataTransmission.signalStrength) > 80
                  ? "bg-emerald-500 hover:bg-emerald-800"
                  : data?.dataTransmission.signalStrength &&
                    parseInt(data?.dataTransmission.signalStrength) > 40
                  ? "bg-orange-500 hover:bg-orange-800"
                  : "bg-rose-500 hover:bg-rose-800"
              }`}
            >
              {data?.dataTransmission.signalStrength}
            </Badge>
          )}
        </div>

        <div className="flex flex-row justify-between text-md">
          <p>MIMO Layers</p>
          {isLoading ? (
            <Skeleton className="h-4 w-[100px]" />
          ) : (
            <p className="font-bold">{data?.dataTransmission.mimoLayers}</p>
          )}
        </div>

        <div className="flex flex-row justify-between text-md">
          <p>Bytes Sent</p>
          <p className="font-bold">{bytesSent}</p>
        </div>

        <div className="flex flex-row justify-between text-md">
          <p>Bytes Received</p>
          <p className="font-bold">{bytesReceived}</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default DataTransmission;

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface BandCardProps {
  id: number;
  bandNumber: string;
  earfcn: string;
  bandwidth: string;
  pci: string;
  rsrp: string;
  rsrq: string;
  sinr: string;
}

const BandCard = ({
  id,
  bandNumber,
  earfcn,
  bandwidth,
  pci,
  rsrp,
  rsrq,
  sinr,
}: BandCardProps) => {
  return (
    <Card className="p-8">
      <div className="flex flex-row items-center gap-6 justify-between">
        <div className="grid gap-2 w-[180px]">
          <h2 className="text-md font-bold">Band</h2>
          <div className="flex flex-row items-center gap-2">
            {/* Remove "LTE" or "NR5G" string from bandNumber */}
            {bandNumber.replace("LTE BAND ", "B").replace("NR5G BAND ", "N")}
            {bandNumber.includes("NR5G") && (
              <Badge className="text-xs bg-blue-600 hover:bg-blue-800">
                NR 5G
              </Badge>
            )}
          </div>
        </div>

        <div className="grid gap-2">
          <p className="text-sm font-bold">E/ARFCN</p>
          <p>{earfcn}</p>
        </div>

        <div className="grid gap-2">
          <p className="text-sm font-bold">Bandwidth</p>
          <p>{bandwidth}</p>
        </div>

        <div className="grid gap-2">
          <p className="text-sm font-bold">Physical Cell ID</p>
          <p>{pci}</p>
        </div>

        <div className="grid gap-2">
          <p className="text-sm font-bold">RSRP</p>
          <Badge
            className={
              parseInt(rsrp) >= -80
                ? "bg-emerald-500 hover:bg-emerald-800"
                : parseInt(rsrp) >= -100
                ? "bg-orange-500 hover:bg-orange-800"
                : "bg-rose-500 hover:bg-rose-800"
            }
          >
            {rsrp} dBm
          </Badge>
        </div>

        <div className="grid gap-2">
          <p className="text-sm font-bold">RSRQ</p>
          <Badge
            className={
              parseInt(rsrq) <= 10
                ? "bg-emerald-500 hover:bg-emerald-800"
                : parseInt(rsrq) <= 20
                ? "bg-orange-500 hover:bg-orange-800"
                : "bg-rose-500 hover:bg-rose-800"
            }
          >
            {rsrq} dB
          </Badge>
        </div>

        <div className="grid gap-2"> 
          {/* When it is LTE show "SINR" and if 5G, show NR-SNR */}
          <p className="text-sm font-bold">
            {bandNumber.includes("NR5G") ? "NR-SNR" : "SINR"}
          </p>
          {/* Adjusted the coloring for SINR's minVal on the high to 14 for LTE,  middle range to >= -2 /* }
          {/* Even thirds spread puts LTE high range to 14, and mid range to -2 for both /*}
          {/* NR5G range is -23 to 40 */}
          {/* LTE range is -20 to 30 */}
          <Badge
            className={
              parseInt(sinr) >= (bandNumber.includes("NR5G") ? 20 : 14)
                ? "bg-emerald-500 hover:bg-emerald-800"
                : parseInt(sinr) >= -2
                ? "bg-orange-500 hover:bg-orange-800"
                : "bg-rose-500 hover:bg-rose-800"
            }
          >
            {sinr} dB
          </Badge>
        </div>
      </div>
    </Card>
  );
};

export default BandCard;

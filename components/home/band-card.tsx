import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id });

  const style = {
    transition,
    transform: CSS.Transform.toString(transform),
  };

  return (
    <Card
      className="p-8 touch-action-none"
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={style}
    >
      <div className="flex flex-row items-center gap-6 justify-between">
        <div className="grid gap-2 w-[120px]">
          <h2 className="text-md font-bold">Band</h2>
          <p>{bandNumber}</p>
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
            {rsrp}
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
            {rsrq}
          </Badge>
        </div>

        <div className="grid gap-2">
          <p className="text-sm font-bold">SINR</p>
          <Badge
            className={
              parseInt(sinr) >= 20
                ? "bg-emerald-500 hover:bg-emerald-800"
                : parseInt(sinr) >= 0
                ? "bg-orange-500 hover:bg-orange-800"
                : "bg-rose-500 hover:bg-rose-800"
            }
          >
            {sinr}
          </Badge>
        </div>
      </div>
    </Card>
  );
};

export default BandCard;

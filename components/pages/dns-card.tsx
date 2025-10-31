import { useState, useEffect } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Skeleton } from "../ui/skeleton";
import { Separator } from "@radix-ui/react-separator";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";



interface DNSCardProps {
  passthrough: string | null
}
interface Options {
  mode: string | null;
  dns1: string;
  dns2: string;
  dns3: string;
}

const isLoading = false;


const DNSCard = (
  currentSettings: DNSCardProps
) => {
  const [currentOptions, setCurrentOptions] = useState<Options>({
    mode: null,
    dns1: "",
    dns2: "",
    dns3: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const activeNic = (currentSettings: DNSCardProps ) => currentSettings?.passthrough && currentSettings?.passthrough?.toLowerCase().trim() !== 'disabled' ? "lan_bind4" : "lan";

  const handleSave = async () => {
    setIsSaving(true);
    
    try {
      const nic = activeNic(currentSettings);
      const payload = {
        mode: currentOptions.mode || "disabled",
        nic: nic,
        dns1: currentOptions.dns1,
        dns2: currentOptions.dns2,
        dns3: currentOptions.dns3,
      };

      const response = await fetch("/cgi-bin/quecmanager/advance/dns.sh", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `${localStorage.getItem("authToken")}`,
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "DNS Settings Saved",
          description: `Successfully updated DNS settings for ${nic}`,
        });
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to save DNS settings",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to communicate with the server",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };


  useEffect(() => {
    let url = `/cgi-bin/quecmanager/advance/dns.sh?nic=${activeNic(currentSettings)}`;
    const fetchDNSSettings = async () => {
      try {
        const response = await fetch(url, {
          method: "GET",
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `${localStorage.getItem("authToken")}`,
          },
        });

        if (!response.ok) {
          throw new Error("Network response was not ok");
        }

        const result = await response.json();
        if (result.currentDNS && result.currentDNS.length > 0) {
          const list = result.currentDNS.split(",");
          setCurrentOptions({
            mode: result.mode,
            dns1: list[0] || "",
            dns2: list[1] || "",
            dns3: list[2] || "",
          });
        }
      } catch (error) {
        console.error("Failed to fetch DNS settings:", error);
      }
    }
    fetchDNSSettings();
    setCurrentOptions((prev) => ({
      ...prev,
    }))
  }, [currentSettings]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>DNS Setings</CardTitle>
        <CardDescription>
          Configure DNS settings for your network clients
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4 w-full">
          <div className="grid w-full items-center gap-2">
              <Label htmlFor="dns-mode">Custom DNS Mode</Label>
              {isLoading ? (
                <Skeleton className="w-full h-8" />
              ) : (
                <div className="flex items-center space-x-2">
                  <Switch
                    id="dns-mode"
                    checked={currentOptions.mode === 'enabled'}
                    onCheckedChange={(checked) => {
                      setCurrentOptions((prev) => ({
                        ...prev,
                        mode: checked ? 'enabled' : 'disabled',
                      }));
                    }}
                  />
                  <Label htmlFor="dns-mode" className="cursor-pointer">
                    {currentOptions.mode === 'enabled' ? 'Enabled' : 'Disabled'}
                  </Label>
                </div>
              )}
            </div>
          <Separator className="my-2" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
            {['Primary', 'Secondary', 'Tertiary'].map((label, index) => (
              <div key={index} className="grid gap-2 w-full">
                <Label htmlFor={`dns-${index}`} className="text-sm text-muted-foreground">
                  {label} DNS
                </Label>
                {isLoading ? (
                  <Skeleton className="h-10 w-full" />
                ) : (
                  <Input
                    id={`dns-${index}`}
                    type="text"
                    placeholder={`Enter ${label.toLowerCase()} DNS`}
                    className="w-full"
                    disabled={currentOptions.mode !== 'enabled'}
                    value={currentOptions[`dns${index + 1}` as keyof Options] as string}
                    onChange={(e) => {
                      setCurrentOptions((prev) => ({
                        ...prev,
                        [`dns${index + 1}`]: e.target.value,
                      }));
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-end">
        <Button 
          onClick={handleSave} 
          disabled={isSaving}
        >
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isSaving ? "Saving..." : "Save DNS Settings"}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default DNSCard;

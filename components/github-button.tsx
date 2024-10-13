import { Button } from "@/components/ui/button";
import { GitHubLogoIcon } from "@radix-ui/react-icons";

const GithubButtonToast = () => {
  return (
    <Button asChild variant="outline" className="ml-2">
        <a href="https://github.com/iamromulan/quectel-rgmii-toolkit/tree/development-SDXPINN">
        <GitHubLogoIcon className="w-4 h-4 mr-2" />
        Get there!
        </a>
    </Button>
  )
}

export default GithubButtonToast
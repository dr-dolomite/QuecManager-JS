import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
const ExperimentalPage = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Experimental</CardTitle>
        <CardDescription>This is an experimental page.</CardDescription>
      </CardHeader>
      <CardContent>
        <p>Whoops! Theres nothing here yet...</p>
      </CardContent>
    </Card>
  );
};

export default ExperimentalPage;

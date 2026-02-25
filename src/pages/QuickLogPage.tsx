import Card from "../components/ui/Card";

export default function QuickLogPage() {
  return (
    <div className="p-4">
      <h1 className="font-display text-2xl font-bold text-green-800">
        Quick Log
      </h1>
      <Card className="mt-4">
        <p className="text-soil-700">
          Quick log — snap a photo, tag a plant, save.
        </p>
      </Card>
    </div>
  );
}

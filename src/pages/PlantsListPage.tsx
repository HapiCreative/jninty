import Card from "../components/ui/Card";

export default function PlantsListPage() {
  return (
    <div className="p-4">
      <h1 className="font-display text-2xl font-bold text-green-800">
        Plant Inventory
      </h1>
      <Card className="mt-4">
        <p className="text-soil-700">Your plants will appear here.</p>
      </Card>
    </div>
  );
}

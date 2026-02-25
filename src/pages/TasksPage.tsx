import Card from "../components/ui/Card";

export default function TasksPage() {
  return (
    <div className="p-4">
      <h1 className="font-display text-2xl font-bold text-green-800">
        Tasks
      </h1>
      <Card className="mt-4">
        <p className="text-soil-700">Your tasks will appear here.</p>
      </Card>
    </div>
  );
}

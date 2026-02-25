import Card from "../components/ui/Card";

export default function DashboardPage() {
  return (
    <div className="p-4">
      <h1 className="font-display text-2xl font-bold text-green-800">
        Dashboard
      </h1>
      <Card className="mt-4">
        <p className="text-soil-700">
          Welcome to Jninty — your personal garden journal.
        </p>
      </Card>
    </div>
  );
}

import Card from "../components/ui/Card";

export default function JournalPage() {
  return (
    <div className="p-4">
      <h1 className="font-display text-2xl font-bold text-green-800">
        Journal
      </h1>
      <Card className="mt-4">
        <p className="text-soil-700">Your journal entries will appear here.</p>
      </Card>
    </div>
  );
}

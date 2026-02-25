import Card from "../components/ui/Card";

export default function SettingsPage() {
  return (
    <div className="p-4">
      <h1 className="font-display text-2xl font-bold text-green-800">
        Settings
      </h1>
      <Card className="mt-4">
        <p className="text-soil-700">App settings will go here.</p>
      </Card>
    </div>
  );
}

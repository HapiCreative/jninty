import { useParams } from "react-router-dom";
import Card from "../components/ui/Card";

export default function PlantDetailPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="p-4">
      <h1 className="font-display text-2xl font-bold text-green-800">
        Plant Detail
      </h1>
      <Card className="mt-4">
        <p className="text-soil-700">Details for plant {id}.</p>
      </Card>
    </div>
  );
}

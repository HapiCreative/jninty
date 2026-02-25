import { Link } from "react-router-dom";
import Card from "../components/ui/Card";

export default function NotFoundPage() {
  return (
    <div className="p-4">
      <h1 className="font-display text-2xl font-bold text-green-800">
        Page Not Found
      </h1>
      <Card className="mt-4">
        <p className="text-soil-700">
          The page you're looking for doesn't exist.
        </p>
        <Link
          to="/"
          className="mt-3 inline-block text-sm font-medium text-green-700 hover:text-green-800"
        >
          Back to Dashboard
        </Link>
      </Card>
    </div>
  );
}

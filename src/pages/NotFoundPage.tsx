import { Link } from "react-router-dom";
import Card from "../components/ui/Card";

export default function NotFoundPage() {
  return (
    <div className="p-4">
      <h1 className="font-display text-2xl font-bold text-text-heading">
        Page Not Found
      </h1>
      <Card className="mt-4">
        <p className="text-text-secondary">
          The page you're looking for doesn't exist.
        </p>
        <Link
          to="/"
          className="mt-3 inline-block text-sm font-medium text-text-heading hover:text-text-heading"
        >
          Back to Dashboard
        </Link>
      </Card>
    </div>
  );
}

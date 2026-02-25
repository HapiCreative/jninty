import { BrowserRouter, Routes, Route } from "react-router-dom";

function HomePage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center px-4">
      <h1 className="font-display text-4xl font-bold text-green-800">
        Hello Jninty
      </h1>
      <p className="mt-3 text-lg text-brown-700">
        Your personal garden journal — coming soon.
      </p>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
      </Routes>
    </BrowserRouter>
  );
}

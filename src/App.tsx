import { useEffect, useState } from "react";
import type { GedcomData } from "./lib/gedcom-parser";
import { fetchAndParseGedcom } from "./lib/gedcom-parser";
import CustomViewerPage from "./pages/CustomViewerPage";

export default function App() {
  const [data, setData] = useState<GedcomData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAndParseGedcom("/tree/famillechene_61739.ged")
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen text-gray-500">
        Loading GEDCOM data...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-screen text-red-500">
        Error: {error || "No data loaded"}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      <nav className="flex items-center px-4 py-2 bg-white border-b border-gray-200 shrink-0 z-10">
        <span className="font-semibold text-gray-800">Geneao</span>
      </nav>
      <div className="flex-1 overflow-hidden">
        <CustomViewerPage data={data} />
      </div>
    </div>
  );
}

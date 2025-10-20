import Dashboard from "./components/Dashboard";
import { getEnabledClientTools } from "../tools";

export default function Home() {
  const enabledTools = getEnabledClientTools();

  return <Dashboard enabledTools={enabledTools} />;
}

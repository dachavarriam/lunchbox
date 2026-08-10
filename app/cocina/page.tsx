import { PrototypeApp } from "../prototype-app";

export default function KitchenPage() {
  return <PrototypeApp initialSurface="kitchen" nowIso={new Date().toISOString()} />;
}

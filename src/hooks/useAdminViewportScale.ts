import { useEffect, useState } from "react";
import { getAdminViewportScale } from "../components/admin/adminConstants";

function readViewportScale(): number {
  return getAdminViewportScale(window.innerWidth, window.innerHeight);
}

export function useAdminViewportScale(): number {
  const [scale, setScale] = useState(() =>
    typeof window !== "undefined" ? readViewportScale() : 1
  );

  useEffect(() => {
    const update = () => setScale(readViewportScale());
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return scale;
}
import { permanentRedirect } from "next/navigation";

export default function LegacyBrandsPage() {
  permanentRedirect("/partners");
}

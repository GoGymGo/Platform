import { redirect } from "next/navigation";
import { siteLinks } from "../site-links";

export default function DemoPage() {
  redirect(siteLinks.demo);
}

import { redirect } from "next/navigation";

export const metadata = { title: "Media" };

export default function MediaPage() {
  redirect("/admin/listings");
}

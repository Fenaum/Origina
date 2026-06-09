import { AppLayout } from "@/components/app/AppLayout";
import { MismoUpload } from "@/components/submission/mismo/MismoUpload";

export default function MismoImportPage() {
  return (
    <AppLayout allowedRoles={["account_executive", "broker"]}>
      <MismoUpload />
    </AppLayout>
  );
}

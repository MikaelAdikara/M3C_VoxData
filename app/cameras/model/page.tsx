import { CameraModelScreen } from "@/components/vision/CameraModelScreen";
import { getCameraModelView } from "@/lib/queries";

export const metadata = { title: "Camera model · Learning Line" };

export default async function CameraModelPage() {
  return <CameraModelScreen view={await getCameraModelView()} />;
}

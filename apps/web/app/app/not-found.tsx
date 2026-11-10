import { APP_HOME_PATH } from "../../lib/auth/route-rules";
import { NotFoundContent } from "../_components/not-found-content";

export default function AppNotFound() {
  return <NotFoundContent homeHref={APP_HOME_PATH} homeLabel="Go to home" />;
}

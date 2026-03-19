import { useAuth } from "@/lib/auth";
import OperadorPage from "./OperadorPage";
import ConferentePage from "./ConferentePage";
import AdminPage from "./AdminPage";

const Index = () => {
  const { userRole } = useAuth();

  switch (userRole) {
    case "admin":
      return <AdminPage />;
    case "conferente":
      return <ConferentePage />;
    default:
      return <OperadorPage />;
  }
};

export default Index;
1;

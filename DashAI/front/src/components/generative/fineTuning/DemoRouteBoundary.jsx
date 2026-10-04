import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Alert, Button } from "@mui/material";
import { ArrowBack } from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import CustomLayout from "../../custom/CustomLayout";
import {
  DEMO_ROUTE,
  fineTuningDemoEnabled,
} from "../../../api/fineTuningDemo/config";
import "./demoStrings";

export default function DemoRouteBoundary({ children }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation("fineTuningDemo");
  if (!fineTuningDemoEnabled) return children;
  if (["/", "/app"].includes(pathname))
    return <Navigate to={DEMO_ROUTE} replace />;
  if (
    pathname === "/app/generative" ||
    pathname.startsWith(`${DEMO_ROUTE}`) ||
    pathname.startsWith("/app/data")
  )
    return children;
  return (
    <CustomLayout>
      <Alert severity="info">{t("outsideDemo")}</Alert>
      <Button
        sx={{ mt: 4 }}
        startIcon={<ArrowBack />}
        onClick={() => navigate(DEMO_ROUTE)}
      >
        {t("back")}
      </Button>
    </CustomLayout>
  );
}

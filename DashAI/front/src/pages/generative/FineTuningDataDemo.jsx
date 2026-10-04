import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Box,
  Button,
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { ArrowBack, UploadFileOutlined } from "@mui/icons-material";
import CustomLayout from "../../components/custom/CustomLayout";
import ModuleThemeWrapper from "../../components/ModuleThemeWrapper";
import { DEMO_ROUTE } from "../../api/fineTuningDemo/config";
import { fineTuningDemoStore as store } from "../../api/fineTuningDemo/store";
import useFineTuningDemo from "../../hooks/generative/useFineTuningDemo";
import { Section } from "../../components/generative/fineTuning/DemoCommon";

export default function FineTuningDataDemo() {
  const { t } = useTranslation("fineTuningDemo");
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const state = useFineTuningDemo();
  const sessionId = params.get("fineTuningSession");
  const session = state.sessions.find((s) => s.id === sessionId);
  const useDataset = (id) => {
    if (session) store.selectDataset(session.id, id);
    navigate(
      session
        ? `${DEMO_ROUTE}/sessions/${session.id}/configure/data`
        : DEMO_ROUTE,
    );
  };
  return (
    <ModuleThemeWrapper>
      <CustomLayout title="Data" padding={0}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          sx={{ mb: 4 }}
        >
          <Button
            startIcon={<ArrowBack />}
            onClick={() =>
              navigate(
                session
                  ? `${DEMO_ROUTE}/sessions/${session.id}/configure/data`
                  : DEMO_ROUTE,
              )
            }
          >
            {t("back")}
          </Button>
          <Chip label={t("demo")} size="small" variant="outlined" />
        </Stack>
        <Section title={t("importTitle")}>
          <Stack direction={{ xs: "column", sm: "row" }} gap={3}>
            {["alpaca", "pairs", "messages"].map((format) => (
              <Button
                variant="outlined"
                key={format}
                startIcon={<UploadFileOutlined />}
                onClick={() => useDataset(store.importExample(format))}
              >
                {t("import")} · {t(format)}
              </Button>
            ))}
          </Stack>
        </Section>
        <Section title={t("importDescription")}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t("dataset")}</TableCell>
                  <TableCell>{t("format")}</TableCell>
                  <TableCell>{t("rows")}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {state.datasets.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>
                      <Button
                        sx={{ textTransform: "none" }}
                        onClick={() => useDataset(d.id)}
                      >
                        {d.name}
                      </Button>
                    </TableCell>
                    <TableCell>{t(d.format)}</TableCell>
                    <TableCell>{d.rows.length}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Section>
        <Box sx={{ mt: 5 }}>
          <Alert severity="info">{t("disclosure")}</Alert>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block", mt: 4 }}
          >
            {session?.name}
          </Typography>
        </Box>
      </CustomLayout>
    </ModuleThemeWrapper>
  );
}

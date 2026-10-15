import { useMemo, useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import { Close } from "@mui/icons-material";
import PillTabs from "../../shared/PillTabs";
import SftExampleView, { SftLegend } from "./SftExampleView";
import { renderSftExample } from "../data/sft";
import { datasetName, formatLabel } from "../data/labels";

const PREVIEW_ROWS = 10;
const CELL_CHARS = 120;
const SFT_EXAMPLES = 3;

function cellText(value) {
  if (value === null || value === undefined) return "";
  return typeof value === "string" ? value : JSON.stringify(value);
}

function MetaItem({ label, children }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary" component="p">
        {label}
      </Typography>
      <Box sx={{ typography: "body2", fontWeight: 500 }}>{children}</Box>
    </Box>
  );
}

MetaItem.propTypes = { label: PropTypes.node, children: PropTypes.node };

/**
 * "Dataset Preview" dialog: source, detected format, total rows, column
 * chips, readiness Alert, PillTabs "Datos originales" | "Ejemplos SFT",
 * table of the first 10 rows and "Mostrando 10 de N filas".
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {object} props.dataset DatasetRef
 * @param {string[]} props.columns
 * @param {object[]} props.rows available rows (sample or full)
 * @param {number} props.totalRows
 * @param {boolean} [props.sampled]
 * @param {string|null} [props.format]
 * @param {object|null} [props.detection]
 * @param {boolean} [props.ready] data step ready (format confirmed, no blocking issues)
 * @param {{sourceIndex, messages}[]} [props.examples] normalized examples
 * @param {number} [props.maxLength]
 */
export default function DatasetPreviewDialog({
  open,
  onClose,
  dataset,
  columns,
  rows,
  totalRows,
  sampled,
  format,
  detection,
  ready,
  examples,
  maxLength,
}) {
  const { t } = useTranslation(["fineTuning", "common"]);
  const [tab, setTab] = useState("raw");
  const cols = Array.isArray(columns) ? columns : [];
  const list = Array.isArray(rows) ? rows : [];
  const shown = list.slice(0, PREVIEW_ROWS);
  const total = Number(totalRows) || list.length;
  const rendered = useMemo(
    () =>
      open
        ? (examples || []).slice(0, SFT_EXAMPLES).map((ex) => ({
            ...ex,
            rendered: renderSftExample(ex.messages, { maxLength }),
          }))
        : [],
    [open, examples, maxLength],
  );
  if (!dataset) return null;

  let statusAlert;
  if (ready && format) {
    statusAlert = (
      <Alert severity="success" sx={{ py: 0.5 }}>
        {t("fineTuning:dataPrep.preview.ready", {
          format: formatLabel(format, t),
        })}
      </Alert>
    );
  } else if (detection && detection.reason === "text_only" && !format) {
    statusAlert = (
      <Alert severity="warning" sx={{ py: 0.5 }}>
        {t("fineTuning:datasets.detection.text_only")}
      </Alert>
    );
  } else {
    statusAlert = (
      <Alert severity="warning" sx={{ py: 0.5 }}>
        {format
          ? t("fineTuning:dataPrep.preview.needsMapping")
          : t("fineTuning:dataPrep.preview.noFormat")}
      </Alert>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      aria-labelledby="ft-dataset-preview-title"
      slotProps={{
        paper: {
          sx: { minHeight: 500, borderRadius: 2, backgroundImage: "none" },
        },
      }}
    >
      <DialogTitle
        id="ft-dataset-preview-title"
        sx={{ display: "flex", alignItems: "center", gap: 2, pr: 12 }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant="h6"
            component="span"
            noWrap
            sx={{ display: "block" }}
          >
            {t("fineTuning:dataPrep.preview.title")}
          </Typography>
          <Typography variant="body2" color="text.secondary" noWrap>
            {datasetName(dataset, t)}
          </Typography>
        </Box>
        <IconButton
          aria-label={t("fineTuning:dataPrep.preview.close")}
          onClick={onClose}
          sx={{ position: "absolute", right: 16, top: 16 }}
        >
          <Close />
        </IconButton>
      </DialogTitle>
      <DialogContent
        dividers
        sx={{
          bgcolor: "background.paper",
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr 1fr",
              md: "repeat(4, minmax(0, 1fr))",
            },
            gap: 4,
          }}
        >
          <MetaItem label={t("fineTuning:dataPrep.preview.source")}>
            {t(`fineTuning:datasets.source.${dataset.source}`)}
          </MetaItem>
          <MetaItem label={t("fineTuning:dataPrep.preview.format")}>
            {formatLabel(format || (detection && detection.format), t)}
          </MetaItem>
          <MetaItem label={t("fineTuning:dataPrep.preview.totalRows")}>
            {total}
          </MetaItem>
          <MetaItem label={t("fineTuning:dataPrep.preview.columnCount")}>
            {cols.length}
          </MetaItem>
        </Box>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
          {cols.map((c) => (
            <Chip
              key={c}
              size="small"
              variant="outlined"
              label={c}
              sx={{
                fontFamily: (th) =>
                  th.typography.code?.fontFamily || "monospace",
              }}
            />
          ))}
        </Box>
        {statusAlert}

        <PillTabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          variant="fullWidth"
        >
          <Tab value="raw" label={t("fineTuning:dataPrep.preview.tabRaw")} />
          <Tab
            value="sft"
            label={t("fineTuning:dataPrep.preview.tabSft")}
            disabled={rendered.length === 0}
          />
        </PillTabs>

        {tab === "raw" &&
          (shown.length === 0 ? (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ textAlign: "center", py: 6 }}
            >
              {t("fineTuning:dataPrep.preview.noRows")}
            </Typography>
          ) : (
            <TableContainer
              sx={{
                border: 1,
                borderColor: "divider",
                borderRadius: 1,
                maxHeight: 420,
              }}
            >
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ width: 48, bgcolor: "background.paper" }}>
                      #
                    </TableCell>
                    {cols.map((c) => (
                      <TableCell
                        key={c}
                        sx={{
                          fontWeight: 600,
                          bgcolor: "background.paper",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {c}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {shown.map((row, i) => (
                    <TableRow key={i} hover>
                      <TableCell sx={{ color: "text.secondary" }}>
                        {i + 1}
                      </TableCell>
                      {cols.map((c) => {
                        const text = cellText(row ? row[c] : "");
                        const long = text.length > CELL_CHARS;
                        const content = (
                          <Box
                            component="span"
                            sx={{
                              display: "-webkit-box",
                              WebkitLineClamp: 3,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                              maxWidth: 360,
                              wordBreak: "break-word",
                              color: text ? "text.primary" : "text.disabled",
                            }}
                          >
                            {text || t("fineTuning:dataPrep.preview.empty")}
                          </Box>
                        );
                        return (
                          <TableCell key={c} sx={{ verticalAlign: "top" }}>
                            {long ? (
                              <Tooltip
                                title={text.slice(0, 1200)}
                                placement="top-start"
                              >
                                {content}
                              </Tooltip>
                            ) : (
                              content
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ))}

        {tab === "sft" && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <SftLegend />
            {rendered.map((ex, i) => (
              <SftExampleView
                key={ex.sourceIndex}
                rendered={ex.rendered}
                maxLength={maxLength}
                title={t("fineTuning:dataPrep.example.title", {
                  n: i + 1,
                  row: ex.sourceIndex + 1,
                })}
              />
            ))}
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 4, justifyContent: "space-between" }}>
        <Typography variant="caption" color="text.secondary">
          {tab === "raw"
            ? t("fineTuning:dataPrep.preview.footer", {
                shown: shown.length,
                total,
              })
            : t("fineTuning:dataPrep.preview.footerSft", {
                shown: rendered.length,
                total: (examples || []).length,
              })}
          {sampled && ` · ${t("fineTuning:dataPrep.preview.sampledNote")}`}
        </Typography>
        <Button variant="outlined" onClick={onClose}>
          {t("fineTuning:dataPrep.preview.close")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

DatasetPreviewDialog.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func,
  dataset: PropTypes.object,
  columns: PropTypes.arrayOf(PropTypes.string),
  rows: PropTypes.arrayOf(PropTypes.object),
  totalRows: PropTypes.number,
  sampled: PropTypes.bool,
  format: PropTypes.string,
  detection: PropTypes.object,
  ready: PropTypes.bool,
  examples: PropTypes.arrayOf(PropTypes.object),
  maxLength: PropTypes.number,
};

import { Box, Chip, Tooltip, Typography } from "@mui/material";
import ScienceOutlinedIcon from "@mui/icons-material/ScienceOutlined";
import { useTranslation } from "react-i18next";

const TOOLTIP_LINES = ["simulated", "realData", "noBackend", "storage"];

/**
 * The single disclaimer of the fine-tuning prototypes: a small outlined chip
 * ("Prototipo · datos simulados") whose tooltip explains what is simulated
 * and what is real. Renders without the fine-tuning provider.
 *
 * Props:
 * - prototype?: "A" | "B"  adds the variant letter to the label.
 * - storageError?: boolean  warns that changes are not being persisted.
 * - size?: "small" | "medium" (default "small").
 * - sx?: extra styles for the chip.
 */
export default function PrototypeBadge({
  prototype,
  storageError = false,
  size = "small",
  sx,
}) {
  const { t } = useTranslation(["fineTuning"]);

  const label = prototype
    ? t("fineTuning:prototype.badgeWithVariant", { prototype })
    : t("fineTuning:prototype.badge");

  const tooltip = (
    <Box sx={{ p: 1, maxWidth: 320 }}>
      <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
        {t("fineTuning:prototype.tooltipTitle")}
      </Typography>
      <Box component="ul" sx={{ m: 0, pl: 4 }}>
        {TOOLTIP_LINES.map((key) => (
          <Typography key={key} component="li" variant="caption">
            {t(`fineTuning:prototype.tooltip.${key}`)}
          </Typography>
        ))}
      </Box>
      {storageError && (
        <Typography
          variant="caption"
          component="p"
          sx={{ mt: 1, fontWeight: 600 }}
        >
          {t("fineTuning:prototype.storageError")}
        </Typography>
      )}
    </Box>
  );

  return (
    <Tooltip title={tooltip} arrow>
      <Chip
        icon={<ScienceOutlinedIcon />}
        label={label}
        size={size}
        variant="outlined"
        tabIndex={0}
        sx={{
          color: "text.secondary",
          borderColor: storageError ? "warning.main" : "divider",
          "& .MuiChip-icon": { color: "warning.main" },
          ...sx,
        }}
      />
    </Tooltip>
  );
}

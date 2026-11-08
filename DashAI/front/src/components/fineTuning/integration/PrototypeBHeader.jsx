import PropTypes from "prop-types";
import { Box, Breadcrumbs, IconButton, Link, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import PrototypeBadge from "../common/PrototypeBadge";
import DemoControlsMenu from "../common/DemoControlsMenu";
import { useFineTuningStore } from "../FineTuningContext";
import { FINE_TUNING_A_BASE } from "./entryPoints";

const selectStorageError = (s) => Boolean(s.storageError);

/**
 * Header row of prototype B pages: breadcrumbs in the ModelsBreadcrumbs style
 * (back arrow + MUI Breadcrumbs) on the left; the single prototype badge and
 * the demo controls on the right. Requires <FineTuningProvider>.
 *
 * @param {object} props
 * @param {{label: string, path?: string|null}[]} props.crumbs last one is current
 * @param {import("react").ReactNode} [props.actions] extra nodes before the badge
 */
export default function PrototypeBHeader({ crumbs, actions }) {
  const navigate = useNavigate();
  const { t } = useTranslation(["fineTuning", "common"]);
  const storageError = useFineTuningStore(selectStorageError);
  const list = crumbs || [];
  const parent = list.length > 1 ? list[list.length - 2] : null;

  return (
    <Box
      sx={{
        mb: 4,
        minHeight: 32,
        display: "flex",
        alignItems: "center",
        gap: 2,
        flexWrap: "wrap",
      }}
    >
      {parent && parent.path && (
        <IconButton
          size="small"
          onClick={() => navigate(parent.path)}
          aria-label={t("fineTuning:shellB.header.back")}
          sx={{
            color: "text.secondary",
            "&:hover": {
              color: "primary.main",
              backgroundColor: "action.hover",
            },
          }}
        >
          <ArrowBackIcon fontSize="small" />
        </IconButton>
      )}
      <Breadcrumbs
        aria-label={t("fineTuning:shellB.header.breadcrumbs")}
        sx={{ flex: 1, minWidth: 0 }}
      >
        {list.map((crumb, index) => {
          const current = index === list.length - 1 || !crumb.path;
          if (current) {
            return (
              <Typography
                key={`${crumb.label}-${index}`}
                color="text.primary"
                noWrap
              >
                {crumb.label}
              </Typography>
            );
          }
          return (
            <Link
              key={`${crumb.label}-${index}`}
              underline="hover"
              color="inherit"
              href={crumb.path}
              onClick={(e) => {
                e.preventDefault();
                navigate(crumb.path);
              }}
            >
              {crumb.label}
            </Link>
          );
        })}
      </Breadcrumbs>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        {actions}
        <PrototypeBadge prototype="B" storageError={storageError} />
        <DemoControlsMenu
          otherPrototypeHref={FINE_TUNING_A_BASE}
          otherPrototypeLabel={t("fineTuning:shellB.header.otherPrototype")}
        />
      </Box>
    </Box>
  );
}

PrototypeBHeader.propTypes = {
  crumbs: PropTypes.arrayOf(
    PropTypes.shape({ label: PropTypes.node, path: PropTypes.string }),
  ).isRequired,
  actions: PropTypes.node,
};

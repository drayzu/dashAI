import PropTypes from "prop-types";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
} from "@mui/material";
import { Close } from "@mui/icons-material";
import { useTranslation } from "react-i18next";

/** Small confirmation dialog (cancel run, overwrite draft, delete run). */
export default function RunConfirmDialog({
  open,
  title,
  content,
  confirmLabel,
  confirmColor,
  onConfirm,
  onClose,
}) {
  const { t } = useTranslation(["common"]);
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      onClick={(e) => e.stopPropagation()}
      slotProps={{
        paper: {
          elevation: 0,
          sx: { borderRadius: 2, backgroundImage: "none" },
        },
      }}
    >
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 2,
        }}
      >
        <Typography variant="h6" component="span">
          {title}
        </Typography>
        <IconButton
          size="small"
          onClick={onClose}
          aria-label={t("common:close")}
          sx={{ color: "text.secondary" }}
        >
          <Close fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ whiteSpace: "pre-line" }}
        >
          {content}
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 6, pb: 4 }}>
        <Button onClick={onClose} sx={{ color: "text.secondary" }}>
          {t("common:cancel")}
        </Button>
        <Button
          onClick={onConfirm}
          color={confirmColor}
          variant="contained"
          autoFocus
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

RunConfirmDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  title: PropTypes.node.isRequired,
  content: PropTypes.node,
  confirmLabel: PropTypes.node.isRequired,
  confirmColor: PropTypes.oneOf(["primary", "warning", "error"]),
  onConfirm: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};

RunConfirmDialog.defaultProps = {
  content: null,
  confirmColor: "primary",
};

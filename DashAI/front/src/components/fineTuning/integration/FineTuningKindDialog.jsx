import PropTypes from "prop-types";
import {
  Box,
  Button,
  Card,
  CardActionArea,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from "@mui/material";
import { EXTENSION_CHIP, FINE_TUNING_KINDS } from "./extensions";

/**
 * Prototype G: the grouped "Ajuste fino de LLM" card asks what data the user
 * has and leads to the matching kind of fine-tuning. Each kind is still its
 * own task: the grouping is only how the cards are presented.
 */
export default function FineTuningKindDialog({ open, onClose, onChoose }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ bgcolor: "background.paper" }}>
        ¿Qué datos tienes?
        <Typography variant="body2" color="text.secondary">
          Cada tipo de ajuste fino recibe datos distintos. Elige el que se
          parezca a tu dataset.
        </Typography>
      </DialogTitle>
      <DialogContent dividers sx={{ bgcolor: "background.paper" }}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: 2,
          }}
        >
          {FINE_TUNING_KINDS.map((kind) => {
            const { Icon } = kind;
            return (
              <Card key={kind.id} variant="outlined">
                <CardActionArea
                  onClick={() => onChoose(kind.id)}
                  sx={{ p: 3, height: "100%" }}
                >
                  <Stack spacing={1.5}>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <Icon color="primary" fontSize="small" />
                      <Typography
                        variant="subtitle1"
                        sx={{ fontWeight: 600, flex: 1 }}
                      >
                        {kind.title}
                      </Typography>
                    </Stack>
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                      <Chip
                        size="small"
                        variant="outlined"
                        label={kind.badge}
                      />
                      {!kind.core && (
                        <Chip
                          size="small"
                          color="warning"
                          label={EXTENSION_CHIP}
                        />
                      )}
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      {kind.summary}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{ fontFamily: "monospace" }}
                    >
                      Columnas: {kind.columns}
                    </Typography>
                  </Stack>
                </CardActionArea>
              </Card>
            );
          })}
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 3, bgcolor: "background.paper" }}>
        <Button variant="outlined" onClick={onClose}>
          Cancelar
        </Button>
      </DialogActions>
    </Dialog>
  );
}

FineTuningKindDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onChoose: PropTypes.func.isRequired,
};

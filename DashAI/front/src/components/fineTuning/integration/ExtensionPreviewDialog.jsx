import PropTypes from "prop-types";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { EXTENSION_CHIP, EXTENSIONS } from "./extensions";

function Section({ title, children }) {
  return (
    <Box>
      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
        {title}
      </Typography>
      {children}
    </Box>
  );
}

Section.propTypes = {
  title: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
};

function List({ items, ordered = false }) {
  const Tag = ordered ? "ol" : "ul";
  return (
    <Box component={Tag} sx={{ m: 0, pl: 3 }}>
      {items.map((item) => (
        <Typography key={item} component="li" variant="body2" sx={{ mb: 0.5 }}>
          {item}
        </Typography>
      ))}
    </Box>
  );
}

List.propTypes = {
  items: PropTypes.arrayOf(PropTypes.string).isRequired,
  ordered: PropTypes.bool,
};

/**
 * Preview of a candidate extension (prototype F): what it would add, what its
 * data looks like and how it would fit in DashAI. Nothing in it runs.
 */
export default function ExtensionPreviewDialog({
  extensionId,
  onClose,
  onTry,
}) {
  const extension = extensionId ? EXTENSIONS[extensionId] : null;
  if (!extension) return null;
  const { Icon } = extension;

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ bgcolor: "background.paper" }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Icon color="primary" />
          <Typography variant="h6" component="span" sx={{ flex: 1 }}>
            {extension.title}
          </Typography>
          {extension.badge && (
            <Chip size="small" variant="outlined" label={extension.badge} />
          )}
          <Chip size="small" color="warning" label={EXTENSION_CHIP} />
        </Stack>
      </DialogTitle>
      <DialogContent dividers sx={{ bgcolor: "background.paper" }}>
        <Stack spacing={3}>
          <Typography variant="body1">{extension.summary}</Typography>
          {extension.example && (
            <Section title="Cómo son los datos">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {extension.example.columns.map((column) => (
                      <TableCell key={column} sx={{ fontWeight: 600 }}>
                        {column}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {extension.example.rows.map((row) => (
                    <TableRow key={row.join("|")}>
                      {row.map((cell) => (
                        <TableCell
                          key={cell}
                          sx={{ whiteSpace: "pre-line", verticalAlign: "top" }}
                        >
                          {cell}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Section>
          )}
          {extension.steps && (
            <Section title="Cómo funcionaría">
              <List items={extension.steps} ordered />
            </Section>
          )}
          <Section title="Cómo encaja en DashAI">
            <List items={extension.inDashAI} />
          </Section>
          {extension.note && <Alert severity="info">{extension.note}</Alert>}
          <Typography variant="caption" color="text.secondary">
            Extensión candidata: no forma parte del alcance inicial y no está
            implementada en el prototipo.
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 3, bgcolor: "background.paper" }}>
        {onTry && extensionId === "conversations" && (
          <Button variant="outlined" onClick={onTry}>
            Probar el formato en el prototipo B
          </Button>
        )}
        <Button variant="contained" onClick={onClose}>
          Cerrar
        </Button>
      </DialogActions>
    </Dialog>
  );
}

ExtensionPreviewDialog.propTypes = {
  extensionId: PropTypes.string,
  onClose: PropTypes.func.isRequired,
  onTry: PropTypes.func,
};

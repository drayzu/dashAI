import { useEffect, useState } from "react";
import {
  Button,
  Paper,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { useLocation, useNavigate } from "react-router-dom";
import {
  applyPrototypeFromSearch,
  setActivePrototype,
  useActivePrototype,
} from "../../../utils/demoPrototype";

const isEditableTarget = (target) =>
  target &&
  (target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

// Where each prototype starts when picked from the switcher.
const START = {
  all: "/app/generative",
  A: "/app/generative",
  B: "/app/models",
  C: "/app/generative",
  D: "/app/generative",
  E: "/app/generative",
  F: "/app/models",
};

// Grouped by design: the current one trains in Models and uses the adapter
// from Generative; the earlier ones fine-tuned inside Generative.
const GROUPS = [
  {
    title: "Diseño actual",
    subtitle: "Entrenar en Modelos, usar en Generativo",
    items: {
      B: "B · Ajuste fino en Modelos",
      F: "F · B + extensiones (vista previa)",
    },
  },
  {
    title: "Diseños anteriores",
    subtitle: "Fine-tuning dentro de Generativo",
    items: {
      A: "A · Completo",
      E: "E · Sesión unificada",
      C: "C · Lineal",
      D: "D · Sesión unificada simple",
    },
  },
  { title: "Desarrollo", items: { all: "Todos" } },
];

/**
 * Presenter-only switcher (Ctrl/Cmd+Shift+P, next to Ctrl+Shift+E for view editing): picks which fine-tuning prototype
 * the real DashAI modules show, so each one can be presented on its own.
 * Hidden unless opened; mounted once in App.
 */
export default function PrototypeSwitcher() {
  const [open, setOpen] = useState(false);
  const active = useActivePrototype();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    applyPrototypeFromSearch(location.search);
  }, [location.search]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (
        (event.ctrlKey || event.metaKey) &&
        event.shiftKey &&
        event.code === "KeyP" &&
        !isEditableTarget(event.target)
      ) {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  if (!open) return null;

  return (
    <Paper
      elevation={8}
      sx={{
        position: "fixed",
        top: 72,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 1500,
        p: 3,
        border: 1,
        borderColor: "primary.main",
        maxWidth: "calc(100vw - 32px)",
      }}
    >
      <Stack spacing={2}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          Prototipo a presentar
        </Typography>
        {GROUPS.map((group) => (
          <Stack key={group.title} spacing={1}>
            <Typography variant="caption" color="text.secondary">
              <strong>{group.title}</strong>
              {group.subtitle && ` · ${group.subtitle}`}
            </Typography>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={active}
              onChange={(_, value) => {
                if (!value) return;
                setActivePrototype(value);
                navigate(START[value]);
              }}
              sx={{ flexWrap: "wrap" }}
            >
              {Object.entries(group.items).map(([value, label]) => (
                <ToggleButton key={value} value={value} sx={{ px: 3 }}>
                  {label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Stack>
        ))}
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
        >
          <Typography variant="caption" color="text.secondary">
            Ctrl + Shift + P para mostrar u ocultar · Ctrl + Shift + E para
            editar la vista
          </Typography>
          <Button
            size="small"
            variant="contained"
            onClick={() => setOpen(false)}
          >
            Listo
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}

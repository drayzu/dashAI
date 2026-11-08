// Compact horizontal stepper header for the configuration steps (SPEC §4):
// plain StepLabel style of models/AddModelDialog.jsx (no alternativeLabel),
// ✓ on valid steps, an error dot on invalid ones. Steps after the first
// non-valid step cannot be selected.

import {
  Box,
  Step,
  StepButton,
  StepLabel,
  Stepper,
  Tooltip,
} from "@mui/material";
import CheckIcon from "@mui/icons-material/Check";
import { useTranslation } from "react-i18next";

const ICON_SIZE = 24;

function StepNavIcon({ stepIndex, status, current, locked }) {
  const index = stepIndex;
  const active = current;
  const disabled = locked;
  const valid = status === "valid";
  const invalid = status === "invalid";
  let bgcolor = "action.disabledBackground";
  let color = "text.secondary";
  if (active) {
    bgcolor = "primary.main";
    color = "primary.contrastText";
  } else if (valid) {
    bgcolor = "action.selected";
    color = "primary.main";
  } else if (disabled) {
    color = "text.disabled";
  }
  return (
    <Box
      sx={{
        position: "relative",
        width: ICON_SIZE,
        height: ICON_SIZE,
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor,
        color,
        border: 1,
        borderColor: active || valid ? "primary.main" : "divider",
        typography: "caption",
        fontWeight: 600,
        flexShrink: 0,
      }}
    >
      {valid ? <CheckIcon sx={{ fontSize: 16 }} /> : index + 1}
      {invalid && (
        <Box
          component="span"
          data-testid="step-error-dot"
          sx={{
            position: "absolute",
            top: -2,
            right: -2,
            width: 8,
            height: 8,
            borderRadius: "50%",
            bgcolor: "error.main",
            border: 1,
            borderColor: "background.paper",
          }}
        />
      )}
    </Box>
  );
}

/**
 * @param {object} props
 * @param {{key: string, label: string, status: "valid"|"invalid"|"pending"}[]} props.steps
 * @param {string} props.active key of the active step
 * @param {(key: string) => void} props.onSelect
 * @param {number} [props.maxReachable] highest selectable index; defaults to
 *   the index of the first non-valid step (never past it)
 */
export default function StepNav({
  steps = [],
  active,
  onSelect,
  maxReachable,
  sx,
}) {
  const { t } = useTranslation(["fineTuning", "common"]);
  const activeIndex = Math.max(
    0,
    steps.findIndex((s) => s.key === active),
  );
  const firstNotValid = steps.findIndex((s) => s.status !== "valid");
  const computedMax = firstNotValid === -1 ? steps.length - 1 : firstNotValid;
  const limit =
    typeof maxReachable === "number"
      ? Math.min(maxReachable, computedMax)
      : computedMax;

  return (
    <Stepper
      nonLinear
      activeStep={activeIndex}
      aria-label={t("fineTuning:stepNav.ariaLabel")}
      sx={{ mb: 6, ...sx }}
    >
      {steps.map((step, index) => {
        const isActive = index === activeIndex;
        const disabled = !isActive && index > limit && index > activeIndex;
        const invalid = step.status === "invalid";
        let hint = "";
        if (disabled) hint = t("fineTuning:stepNav.locked");
        else if (invalid) hint = t("fineTuning:stepNav.invalid");
        const statusText =
          step.status === "valid"
            ? t("fineTuning:stepNav.status.valid")
            : invalid
              ? t("fineTuning:stepNav.status.invalid")
              : t("fineTuning:stepNav.status.pending");
        return (
          <Step
            key={step.key}
            completed={step.status === "valid"}
            disabled={disabled}
          >
            <Tooltip
              title={hint}
              disableHoverListener={!hint}
              disableFocusListener={!hint}
            >
              <span>
                <StepButton
                  onClick={() => {
                    if (!disabled && !isActive && onSelect) onSelect(step.key);
                  }}
                  disabled={disabled}
                  aria-current={isActive ? "step" : undefined}
                  aria-label={`${step.label} · ${statusText}`}
                  sx={{ py: 1, px: 2, m: 0, borderRadius: 1 }}
                >
                  <StepLabel
                    error={false}
                    slots={{ stepIcon: StepNavIcon }}
                    slotProps={{
                      stepIcon: {
                        stepIndex: index,
                        status: step.status,
                        current: isActive,
                        locked: disabled,
                      },
                    }}
                    sx={{
                      "& .MuiStepLabel-label": { typography: "body2" },
                      "& .MuiStepLabel-label.Mui-active": {
                        color: "text.primary",
                        fontWeight: 600,
                      },
                      "& .MuiStepLabel-label.Mui-completed": {
                        color: "text.primary",
                      },
                    }}
                  >
                    {step.label}
                  </StepLabel>
                </StepButton>
              </span>
            </Tooltip>
          </Step>
        );
      })}
    </Stepper>
  );
}

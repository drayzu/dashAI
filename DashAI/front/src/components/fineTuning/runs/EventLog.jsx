import { useEffect, useRef } from "react";
import PropTypes from "prop-types";
import { Box, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { eventKey, formatEvent } from "../data/labels";
import { formatClock } from "./runFormat";

const LEVEL_COLOR = {
  warn: "warning.main",
  error: "error.main",
  info: "text.primary",
};

/**
 * Monospace run console (like Models' TechnicalDetails box): one translated
 * line per event with a timestamp. Auto-scrolls while the user is at the
 * bottom.
 */
export default function EventLog({ events, maxHeight, autoScroll, title, sx }) {
  const { t, i18n } = useTranslation(["fineTuning"]);
  const boxRef = useRef(null);
  const stickRef = useRef(true);
  const list = Array.isArray(events) ? events : [];

  const handleScroll = () => {
    const el = boxRef.current;
    if (!el) return;
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
  };

  useEffect(() => {
    const el = boxRef.current;
    if (autoScroll && el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, [list.length, autoScroll]);

  return (
    <Box sx={sx}>
      {title !== false && (
        <Box
          sx={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            mb: 2,
          }}
        >
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            {title || t("fineTuning:runs.log.title")}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t("fineTuning:runs.log.count", { count: list.length })}
          </Typography>
        </Box>
      )}
      <Box
        ref={boxRef}
        role="log"
        aria-live="polite"
        aria-label={t("fineTuning:runs.log.title")}
        tabIndex={0}
        onScroll={handleScroll}
        sx={{
          bgcolor: "background.paper",
          p: 3,
          borderRadius: 1,
          border: 1,
          borderColor: "divider",
          fontFamily: "monospace",
          fontSize: "0.75rem",
          lineHeight: 1.6,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          maxHeight,
          overflow: "auto",
        }}
      >
        {list.length === 0 ? (
          <Box component="span" sx={{ color: "text.secondary" }}>
            {t("fineTuning:runs.log.empty")}
          </Box>
        ) : (
          list.map((event, index) => (
            <Box
              // Events are append-only, so index + time + key is stable.
              key={`${index}-${event.t}-${eventKey(event)}`}
              sx={{
                display: "flex",
                gap: 2,
                color: LEVEL_COLOR[event.level] || "text.primary",
              }}
            >
              <Box
                component="span"
                sx={{ color: "text.secondary", flexShrink: 0 }}
              >
                {formatClock(event.t, i18n.language)}
              </Box>
              <Box component="span">{formatEvent(event, t)}</Box>
            </Box>
          ))
        )}
      </Box>
    </Box>
  );
}

EventLog.propTypes = {
  events: PropTypes.arrayOf(PropTypes.object),
  maxHeight: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  autoScroll: PropTypes.bool,
  title: PropTypes.oneOfType([PropTypes.node, PropTypes.oneOf([false])]),
  sx: PropTypes.object,
};

EventLog.defaultProps = {
  events: [],
  maxHeight: 260,
  autoScroll: true,
  title: null,
  sx: {},
};

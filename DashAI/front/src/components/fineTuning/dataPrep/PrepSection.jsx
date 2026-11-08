import PropTypes from "prop-types";
import { Box, Paper, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

/**
 * Card used by the data-preparation blocks: Paper elevation 0 + 1px divider
 * border, header with an icon tile, title (subtitle2 600), caption subtitle
 * and an optional action. Same look as common/SectionCard (kept local so the
 * dataPrep blocks do not depend on another file's props).
 */
export default function PrepSection({
  icon: Icon,
  title,
  subtitle,
  action,
  children,
  sx,
  contentSx,
}) {
  const theme = useTheme();
  return (
    <Paper
      elevation={0}
      sx={{
        border: 1,
        borderColor: "divider",
        borderRadius: 2,
        bgcolor: "background.paper",
        ...sx,
      }}
    >
      {(title || action) && (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 3,
            px: 4,
            pt: 4,
            pb: children ? 3 : 4,
          }}
        >
          {Icon && (
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: 1,
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                bgcolor: alpha(theme.palette.primary.main, 0.12),
                color: "primary.main",
              }}
            >
              <Icon fontSize="small" />
            </Box>
          )}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              variant="subtitle2"
              component="h3"
              sx={{ fontWeight: 600 }}
            >
              {title}
            </Typography>
            {subtitle && (
              <Typography
                variant="caption"
                color="text.secondary"
                component="p"
              >
                {subtitle}
              </Typography>
            )}
          </Box>
          {action && <Box sx={{ flexShrink: 0 }}>{action}</Box>}
        </Box>
      )}
      {children && <Box sx={{ px: 4, pb: 4, ...contentSx }}>{children}</Box>}
    </Paper>
  );
}

PrepSection.propTypes = {
  icon: PropTypes.elementType,
  title: PropTypes.node,
  subtitle: PropTypes.node,
  action: PropTypes.node,
  children: PropTypes.node,
  sx: PropTypes.object,
  contentSx: PropTypes.object,
};

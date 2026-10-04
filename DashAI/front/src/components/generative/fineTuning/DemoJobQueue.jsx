import { Box } from "@mui/material";
import JobQueueWidget from "../../jobs/JobQueueWidget";

export default function DemoJobQueue() {
  return (
    <Box
      sx={{
        "& > .MuiPaper-root": {
          position: { xs: "static", md: "fixed" },
          maxWidth: { xs: "none", md: 320 },
          width: { xs: "100%", md: 320 },
        },
      }}
    >
      <JobQueueWidget />
    </Box>
  );
}

import { fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import getTheme from "../../../styles/theme";
import FineTuningSimple from "./FineTuningSimple";

function renderPage() {
  return render(
    <ThemeProvider theme={createTheme(getTheme("dark"))}>
      <FineTuningSimple />
    </ThemeProvider>,
  );
}

describe("FineTuningSimple (prototype C)", () => {
  it("blocks Siguiente until a base model is chosen", () => {
    renderPage();
    const next = screen.getByRole("button", { name: "Siguiente" });
    expect(next).toBeDisabled();

    fireEvent.click(screen.getByText("Qwen2.5-0.5B-Instruct"));
    expect(next).toBeEnabled();

    fireEvent.click(next);
    expect(screen.getByText(/Paso 2 de 5/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Siguiente" })).toBeDisabled();
  });

  it("starts over with Nuevo ajuste", () => {
    renderPage();
    fireEvent.click(screen.getByText("Llama-3.2-1B-Instruct"));
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Nuevo ajuste" })[0]);
    expect(screen.getByText(/Paso 1 de 5/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Siguiente" })).toBeDisabled();
  });
});

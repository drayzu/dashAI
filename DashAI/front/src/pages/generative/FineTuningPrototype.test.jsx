import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter, useLocation } from "react-router-dom";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import getTheme from "../../styles/theme";
import i18n from "../../utils/i18n";
import { fineTuningDemoStore as store } from "../../api/fineTuningDemo/store";
import FineTuningPrototype from "./FineTuningPrototype";
import FineTuningDataDemo from "./FineTuningDataDemo";

jest.mock("react-markdown", () => ({ children }) => <>{children}</>);

function Location() {
  return <div data-testid="location">{useLocation().pathname}</div>;
}
function open(path, component = <FineTuningPrototype />) {
  return render(
    <ThemeProvider theme={createTheme(getTheme("light"))}>
      <MemoryRouter initialEntries={[path]}>
        {component}
        <Location />
      </MemoryRouter>
    </ThemeProvider>,
  );
}
beforeEach(async () => {
  store.reset();
  await i18n.changeLanguage("es");
  window.matchMedia = jest.fn().mockImplementation(() => ({
    matches: false,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  }));
});

test("session creation navigates into a new wizard", () => {
  open("/app/generative/fine-tuning");
  fireEvent.click(
    screen.getAllByRole("button", { name: "Nueva sesión", exact: true }).at(-1),
  );
  expect(screen.getByTestId("location")).toHaveTextContent(
    /sessions\/session-\d+\/configure\/model/,
  );
});

test("invalid mapping blocks advancing from the data step", () => {
  store.updateDraft("session-1", {
    mapping: { instruction: "instruction", response: "input" },
    scenario: "invalid_data",
  });
  open("/app/generative/fine-tuning/sessions/session-1/configure/data");
  fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
  expect(screen.getByTestId("location")).toHaveTextContent(/configure\/data/);
  expect(
    screen.getByText(/no contienen respuestas válidas/),
  ).toBeInTheDocument();
});

test("invalid configuration cannot start a run", () => {
  store.updateDraft("session-1", { scenario: "incompatible" });
  open("/app/generative/fine-tuning/sessions/session-1/configure/review");
  expect(
    screen.getByRole("button", { name: "Iniciar ejecución" }),
  ).toBeDisabled();
  fireEvent.click(
    screen.getByRole("button", { name: "Validar configuración" }),
  );
  expect(
    screen.getByText(/no es compatible en este escenario/),
  ).toBeInTheDocument();
});

test("a numeric edit is flushed before leaving the configuration step", () => {
  open("/app/generative/fine-tuning/sessions/session-1/configure/parameters");
  const field = screen.getByRole("spinbutton", { name: "Pasos" });
  fireEvent.change(field, { target: { value: "50" } });
  fireEvent.blur(field);
  fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
  expect(store.getSnapshot().sessions[0].draft.parameters.steps).toBe(50);
});

test("importing an example returns to the same session and preserves its method", () => {
  store.updateDraft("session-1", { method: "lora" });
  open(
    "/app/data/datasets/new?fineTuningSession=session-1",
    <FineTuningDataDemo />,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Importar ejemplo · Conversaciones" }),
  );
  expect(screen.getByTestId("location")).toHaveTextContent(
    /sessions\/session-1\/configure\/data/,
  );
  expect(store.getSnapshot().sessions[0].draft.method).toBe("lora");
  expect(store.getSnapshot().sessions[0].draft.format).toBe("messages");
});

test("an unavailable result cannot open a chat", () => {
  store.setAdapterAvailability("adapter-1", "missing");
  open("/app/generative/fine-tuning/results");
  expect(
    screen.getByRole("button", { name: "Probar en chat Soporte · v1" }),
  ).toBeDisabled();
  expect(
    screen.getByRole("button", { name: "Probar en chat Soporte · v2" }),
  ).toBeEnabled();
});

test("an unknown deep link renders a recoverable not-found state", () => {
  open("/app/generative/fine-tuning/runs/absent");
  expect(screen.getByText("No se encontró este elemento.")).toBeInTheDocument();
});

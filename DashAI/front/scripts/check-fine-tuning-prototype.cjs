/* Run against yarn start:prototype. Set PLAYWRIGHT_MODULE to an installed package. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const origin = process.env.PROTOTYPE_URL || "http://localhost:3000";
const root = "/app/generative/fine-tuning";
const output = path.resolve(process.env.PROTOTYPE_QA_DIR || "prototype-qa");
const key = "dashai:fine-tuning-demo:v1";
fs.mkdirSync(output, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true });
  const failures = [];
  const requests = [];
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    locale: "es-CL",
  });
  context.setDefaultNavigationTimeout(120000);
  await context.addInitScript(() => localStorage.setItem("i18nextLng", "es"));
  const page = await context.newPage();
  page.setDefaultNavigationTimeout(120000);
  const observe = (target) => {
    target.on("pageerror", (error) => failures.push(error.message));
    const check = (value) => {
      const url = new URL(value.replace(/^ws/, "http"));
      if (
        url.origin !== origin ||
        url.pathname.startsWith("/v1/") ||
        url.pathname.startsWith("/api/")
      )
        requests.push(value);
    };
    target.on("request", (request) => check(request.url()));
    target.on("websocket", (socket) => check(socket.url()));
  };
  observe(page);
  const shot = async (name) => {
    await page.waitForTimeout(400);
    await page.screenshot({
      path: path.join(output, `${name}.png`),
      fullPage: true,
    });
    const dimensions = await page.evaluate(() => ({
      width: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    assert.ok(
      dimensions.scroll <= dimensions.width + 1,
      `Horizontal overflow in ${name}: ${JSON.stringify(dimensions)}`,
    );
  };
  const state = () =>
    page.evaluate((k) => JSON.parse(localStorage.getItem(k)), key);
  const go = async (suffix = "") => {
    await page.goto(`${origin}${root}${suffix}`);
    await page
      .getByRole("heading", { name: "Fine-tuning", exact: true })
      .waitFor();
  };
  try {
    await page.goto(`${origin}/app/generative`);
    await page.getByRole("button", { name: /Fine-tuning local/ }).click();
    await page.goto(`${origin}${root}`);
    await page
      .getByRole("heading", { name: "Fine-tuning", exact: true })
      .waitFor({ timeout: 120000 });
    await shot("01-sesiones");
    if (process.argv.includes("--inspect")) {
      console.log(
        JSON.stringify(
          {
            failures,
            requests,
            text: (await page.locator("body").innerText()).slice(0, 2000),
          },
          null,
          2,
        ),
      );
      return;
    }
    await page.clock.install();
    await go("/sessions/session-1/configure/model");
    await shot("02-modelo");
    await page.getByRole("button", { name: "Siguiente", exact: true }).click();
    await page.getByRole("tab", { name: "Ejemplos SFT" }).click();
    await shot("03-datos");
    await page
      .getByText("Plantilla del checkpoint · representación ilustrativa")
      .locator("..")
      .screenshot({ path: path.join(output, "03-vista-previa.png") });
    await page.getByRole("button", { name: "Importar desde Data" }).click();
    await page
      .getByRole("button", { name: "Importar ejemplo · Conversaciones" })
      .click();
    await page.waitForURL(/configure\/data/);
    assert.equal((await state()).sessions[0].draft.format, "messages");
    await page.getByRole("button", { name: "Siguiente", exact: true }).click();
    await page.getByRole("button", { name: "Opciones avanzadas" }).click();
    await shot("04-parametros");
    await page
      .getByRole("heading", { name: "LoRA", exact: true })
      .locator("..")
      .locator("..")
      .screenshot({ path: path.join(output, "04-avanzados.png") });
    await page.getByRole("button", { name: "Siguiente", exact: true }).click();
    await page.getByRole("button", { name: "Validar configuración" }).click();
    await shot("05-revision");
    await page.getByRole("button", { name: "Iniciar ejecución" }).click();
    await page.waitForURL(/\/runs\//);
    await page.clock.fastForward(20000);
    await page.getByText("Entrenamiento", { exact: true }).first().waitFor();
    await shot("06-ejecucion");
    await page.reload();
    await page.clock.fastForward(22000);
    await page
      .getByRole("button", { name: "Probar en chat", exact: true })
      .waitFor();
    await shot("07-resultado");
    assert.equal((await state()).runs[0].status, "FINISHED");
    await page
      .getByRole("button", { name: "Probar en chat", exact: true })
      .click();
    await page
      .getByLabel("Escribe un mensaje")
      .fill("¿Cómo restablezco mi contraseña?");
    await page.getByRole("button", { name: "Enviar", exact: true }).click();
    await page
      .getByRole("combobox", { name: "Adaptador", exact: true })
      .click();
    await page.getByRole("option", { name: /Soporte · v1/ }).click();
    await page.clock.fastForward(2000);
    await page.getByText(/Recibirás un enlace para crear/).waitFor();
    await shot("08-chat");
    const chat = (await state()).chats[0];
    assert.notEqual(chat.messages[0].snapshot.adapterId, chat.adapterId);
    await go("/sessions/session-1/history");
    await shot("09-historial");
    await go("/results");
    await shot("10-adaptadores");
    await page
      .getByRole("button", { name: "Soporte · v1", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Simular adaptador ausente" })
      .click();
    await page.getByRole("button", { name: "Cerrar", exact: true }).click();
    assert.equal(
      await page
        .getByRole("button", { name: "Probar en chat Soporte · v1" })
        .isDisabled(),
      true,
    );
    await shot("11-adaptador-ausente");
    for (const [scenario, label, terminal] of [
      ["oom", "Memoria insuficiente", "ERROR"],
      ["incomplete_download", "Descarga incompleta", "ERROR"],
      ["interrupted", "Interrupción", "ERROR"],
    ]) {
      await go("/sessions/session-1/configure/review");
      await page
        .getByRole("button", { name: "Escenario de demostración" })
        .click();
      await page.getByRole("menuitem", { name: label, exact: true }).click();
      await page.getByRole("button", { name: "Iniciar ejecución" }).click();
      await page.clock.fastForward(23000);
      await page
        .getByRole("button", { name: "Nueva ejecución", exact: true })
        .waitFor();
      assert.equal((await state()).runs[0].status, terminal);
      assert.equal((await state()).runs[0].error, scenario);
      await shot(`12-fallo-${scenario}`);
    }
    for (const label of ["Datos inválidos", "Modelo incompatible"]) {
      await go("/sessions/session-1/configure/review");
      await page
        .getByRole("button", { name: "Escenario de demostración" })
        .click();
      await page.getByRole("menuitem", { name: label, exact: true }).click();
      await page.getByRole("button", { name: "Validar configuración" }).click();
      assert.equal(
        await page
          .getByRole("button", { name: "Iniciar ejecución" })
          .isDisabled(),
        true,
      );
    }
    await go("/sessions/session-1/configure/review");
    await page
      .getByRole("button", { name: "Escenario de demostración" })
      .click();
    await page.getByRole("menuitem", { name: "Éxito", exact: true }).click();
    await page.getByRole("button", { name: "Iniciar ejecución" }).click();
    await page.getByRole("button", { name: "Cancelar", exact: true }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Cancelar", exact: true })
      .click();
    assert.equal((await state()).runs[0].terminationReason, "cancelled");
    await shot("13-cancelacion");
    await page
      .getByRole("button", { name: "Monitor de Hardware", exact: true })
      .click();
    await page.keyboard.press("Escape");
    for (const theme of ["light", "dark"]) {
      const modeContext = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
        locale: "es-CL",
      });
      modeContext.setDefaultNavigationTimeout(120000);
      await modeContext.addInitScript((mode) => {
        localStorage.setItem("i18nextLng", "es");
        localStorage.setItem("themeMode", mode);
      }, theme);
      const other = await modeContext.newPage();
      observe(other);
      await other.goto(`${origin}${root}/sessions/session-1/configure/data`);
      await other
        .getByRole("heading", { name: "Fine-tuning", exact: true })
        .waitFor();
      await other.screenshot({
        path: path.join(output, `14-desktop-${theme}.png`),
        fullPage: true,
      });
      await other.setViewportSize({ width: 390, height: 844 });
      await other.waitForTimeout(400);
      await other.screenshot({
        path: path.join(output, `15-mobile-${theme}.png`),
        fullPage: true,
      });
      assert.ok(
        await other.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth + 1,
        ),
      );
      await other
        .getByRole("button", { name: "Sesiones", exact: true })
        .click();
      await other.getByRole("button", { name: "Cerrar", exact: true }).click();
      await modeContext.close();
    }
    await page.goto(`${origin}/app/models`);
    await page
      .getByText(
        "Esta sección no está incluida en la demostración de fine-tuning.",
      )
      .waitFor();
    await page.getByRole("button", { name: "Volver", exact: true }).click();
    assert.deepEqual(failures, []);
    assert.deepEqual(requests, []);
    console.log(
      "PASS: complete flow, immutable chat selection, import return, reload, errors, cancellation, desktop/mobile and network isolation.",
    );
  } finally {
    fs.writeFileSync(
      path.join(output, "browser-report.json"),
      JSON.stringify({ failures, forbiddenRequests: requests }, null, 2),
    );
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

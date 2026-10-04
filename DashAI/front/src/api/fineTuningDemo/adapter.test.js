import { fineTuningDemoAdapter } from "./adapter";

test("shared providers can load offline fixtures", async () => {
  for (const url of [
    "/v1/dataset/",
    "/v1/folder/",
    "/v1/model-session",
    "/v1/generative-session",
    "/v1/job/changes",
  ]) {
    const response = await fineTuningDemoAdapter({ url, method: "get" });
    expect(response.status).toBe(200);
  }
});

test("only the textual generative task is provided", async () => {
  const response = await fineTuningDemoAdapter({
    url: "/v1/component/",
    params: { select_types: "GenerativeTask" },
  });
  expect(response.data[0].name).toBe("TextToTextGenerationTask");
});

test.each([
  "/v1/fine-tuning/runs",
  "https://huggingface.co/api/models",
  "/v1/credential/HuggingFace/auth",
])("unknown or real mutation %s has no transport fallback", async (url) => {
  await expect(
    fineTuningDemoAdapter({ url, method: "post" }),
  ).rejects.toMatchObject({
    code: "ERR_DEMO_UNSUPPORTED",
    response: { status: 501 },
  });
});

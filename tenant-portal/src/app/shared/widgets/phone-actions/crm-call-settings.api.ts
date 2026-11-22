let fakeClickToCallEnabled = true;

function fakeDelay(ms = 300): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getFakeClickToCallEnabled(): boolean {
  return fakeClickToCallEnabled;
}

export function setFakeClickToCallEnabled(enabled: boolean): void {
  fakeClickToCallEnabled = enabled;
}

// GET /api/tenant/crm/v1/settings
export async function getCrmClickToCallSetting(): Promise<{ clickToCallEnabled: boolean }> {
  await fakeDelay();
  return { clickToCallEnabled: fakeClickToCallEnabled };
}

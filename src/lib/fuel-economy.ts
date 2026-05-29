// Thin client for the EPA fuel economy database (fueleconomy.gov).
// Free, no API key, CORS-enabled — safe to call straight from the browser.
// Powers the cascading Year → Make → Model → Trim picker that resolves a
// vehicle's official EPA combined MPG.

const BASE = 'https://www.fueleconomy.gov/ws/rest';

export type MenuItem = { text: string; value: string };

// The EPA API returns `{ menuItem: [...] }`, `{ menuItem: {...} }` for a single
// result, or `{}` when empty. Normalize all three to an array.
function toItems(data: unknown): MenuItem[] {
  const menu = (data as { menuItem?: MenuItem | MenuItem[] })?.menuItem;
  if (!menu) return [];
  return Array.isArray(menu) ? menu : [menu];
}

async function getJSON(path: string): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Fuel economy API error (${res.status})`);
  return res.json();
}

export async function getYears(): Promise<MenuItem[]> {
  return toItems(await getJSON('/vehicle/menu/year'));
}

export async function getMakes(year: string): Promise<MenuItem[]> {
  return toItems(await getJSON(`/vehicle/menu/make?year=${encodeURIComponent(year)}`));
}

export async function getModels(year: string, make: string): Promise<MenuItem[]> {
  return toItems(
    await getJSON(
      `/vehicle/menu/model?year=${encodeURIComponent(year)}&make=${encodeURIComponent(make)}`,
    ),
  );
}

// Trims/engine options. Each item's `value` is the EPA vehicle id used to fetch MPG.
export async function getOptions(
  year: string,
  make: string,
  model: string,
): Promise<MenuItem[]> {
  return toItems(
    await getJSON(
      `/vehicle/menu/options?year=${encodeURIComponent(year)}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`,
    ),
  );
}

export type VehicleMpg = {
  comb: number; // combined MPG (or MPGe for electric)
  city: number;
  highway: number;
  fuelType: string;
};

export async function getVehicleMpg(id: string): Promise<VehicleMpg | null> {
  const d = (await getJSON(`/vehicle/${encodeURIComponent(id)}`)) as Record<string, string>;
  const comb = Number(d.comb08);
  if (!comb || isNaN(comb)) return null;
  return {
    comb,
    city: Number(d.city08) || comb,
    highway: Number(d.highway08) || comb,
    fuelType: d.fuelType ?? 'Regular Gasoline',
  };
}

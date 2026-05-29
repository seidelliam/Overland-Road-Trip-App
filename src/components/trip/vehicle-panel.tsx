'use client';

import { useEffect, useState } from 'react';
import { Car, Fuel, Gauge, Loader2 } from 'lucide-react';
import { useTripStore } from '@/store/trip-store';
import {
  getYears,
  getMakes,
  getModels,
  getOptions,
  getVehicleMpg,
  type MenuItem,
} from '@/lib/fuel-economy';
import { gasPriceForStates } from '@/lib/gas-prices';
import { formatCurrency } from '@/lib/utils';
import { Input, Label } from '@/components/ui/input';
import { toast } from 'sonner';

const selectTrip = (s: any) => s.trip;
const selectActiveRoute = (s: any) => s.activeRoute();
const selectActiveRouteId = (s: any) => s.activeRouteId;
const selectUpdateTrip = (s: any) => s.updateTrip;
const selectGasCost = (s: any) =>
  s.activeRouteId ? s.gasCostForRoute(s.activeRouteId) : 0;

export function VehiclePanel() {
  const trip = useTripStore(selectTrip);
  const activeRoute = useTripStore(selectActiveRoute);
  const activeRouteId = useTripStore(selectActiveRouteId);
  const updateTrip = useTripStore(selectUpdateTrip);
  const gasCost = useTripStore(selectGasCost);

  const [open, setOpen] = useState(false);
  const [years, setYears] = useState<MenuItem[]>([]);
  const [makes, setMakes] = useState<MenuItem[]>([]);
  const [models, setModels] = useState<MenuItem[]>([]);
  const [trims, setTrims] = useState<MenuItem[]>([]);

  const [year, setYear] = useState(trip.car_year ? String(trip.car_year) : '');
  const [make, setMake] = useState(trip.car_make ?? '');
  const [model, setModel] = useState(trip.car_model ?? '');
  const [loadingMpg, setLoadingMpg] = useState(false);

  const [priceOverride, setPriceOverride] = useState(
    trip.gas_price != null ? String(trip.gas_price) : '',
  );

  // Load the lists. Each level cascades from the one above. When the trip
  // already has a vehicle saved, these effects also re-populate the chain so
  // the dropdowns show the current selection.
  useEffect(() => {
    getYears().then(setYears).catch(() => setYears([]));
  }, []);
  useEffect(() => {
    if (!year) return setMakes([]);
    getMakes(year).then(setMakes).catch(() => setMakes([]));
  }, [year]);
  useEffect(() => {
    if (!year || !make) return setModels([]);
    getModels(year, make).then(setModels).catch(() => setModels([]));
  }, [year, make]);
  useEffect(() => {
    if (!year || !make || !model) return setTrims([]);
    getOptions(year, make, model).then(setTrims).catch(() => setTrims([]));
  }, [year, make, model]);

  async function pickTrim(id: string, trimLabel: string) {
    setLoadingMpg(true);
    try {
      const mpg = await getVehicleMpg(id);
      if (!mpg) {
        toast.error('No MPG data for that selection.');
        return;
      }
      await updateTrip({
        car_year: Number(year),
        car_make: make,
        car_model: model,
        car_trim: trimLabel,
        car_mpg: mpg.comb,
      });
      const unit = /Electricity/i.test(mpg.fuelType) ? 'MPGe' : 'MPG';
      toast.success(`${mpg.comb} ${unit} combined`);
    } catch {
      toast.error('Could not load fuel economy.');
    } finally {
      setLoadingMpg(false);
    }
  }

  function saveOverride(raw: string) {
    const val = raw.trim();
    const num = Number(val);
    updateTrip({ gas_price: val && !isNaN(num) && num > 0 ? num : null });
  }

  const states = (activeRoute?.states as string[] | null) ?? [];
  const autoPrice = gasPriceForStates(states);
  const effectivePrice = trip.gas_price != null ? Number(trip.gas_price) : autoPrice;
  const hasVehicle = trip.car_mpg != null;

  return (
    <div className="rounded-xl border border-border bg-surface/60 p-3 space-y-3">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/15 text-accent">
            <Car className="h-3.5 w-3.5" />
          </div>
          <div className="text-left">
            <div className="text-sm font-semibold text-fg">Vehicle &amp; gas</div>
            <div className="text-xs text-fg-muted">
              {hasVehicle
                ? `${trip.car_year} ${trip.car_make} ${trip.car_model} · ${trip.car_mpg} MPG`
                : 'Set your car to estimate fuel cost'}
            </div>
          </div>
        </div>
        {gasCost > 0 && (
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-fg-muted">
              Gas
            </div>
            <div className="text-sm font-semibold tabular-nums text-fg">
              {formatCurrency(gasCost)}
            </div>
          </div>
        )}
      </button>

      {open && (
        <div className="space-y-3 pt-1">
          <div className="grid grid-cols-2 gap-2">
            <Select
              label="Year"
              value={year}
              items={years}
              onChange={(v) => {
                setYear(v);
                setMake('');
                setModel('');
              }}
            />
            <Select
              label="Make"
              value={make}
              items={makes}
              disabled={!year}
              onChange={(v) => {
                setMake(v);
                setModel('');
              }}
            />
            <Select
              label="Model"
              value={model}
              items={models}
              disabled={!make}
              onChange={(v) => setModel(v)}
            />
            <div className="space-y-1.5">
              <Label>Trim {loadingMpg && <Loader2 className="inline h-3 w-3 animate-spin" />}</Label>
              <select
                value=""
                disabled={!model || loadingMpg}
                onChange={(e) => {
                  const item = trims.find((t) => t.value === e.target.value);
                  if (item) pickTrim(item.value, item.text);
                }}
                className="w-full h-9 px-2 rounded-lg border border-border bg-surface text-sm text-fg disabled:opacity-50 focus-visible:outline-none focus-visible:border-accent/60"
              >
                <option value="">
                  {model ? 'Select…' : '—'}
                </option>
                {trims.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.text}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {hasVehicle && (
            <div className="flex items-center gap-2 text-xs text-fg-muted">
              <Gauge className="h-3.5 w-3.5 text-accent" />
              <span>
                {trip.car_year} {trip.car_make} {trip.car_model}
                {trip.car_trim ? ` · ${trip.car_trim}` : ''} —{' '}
                <span className="text-fg font-medium">{trip.car_mpg} MPG</span>
              </span>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="gas-price" className="flex items-center gap-1.5">
              <Fuel className="h-3.5 w-3.5" />
              Gas price ($/gal)
            </Label>
            <Input
              id="gas-price"
              type="number"
              step="0.01"
              min="0"
              placeholder={`Auto: $${autoPrice.toFixed(2)}${
                states.length ? ` (${states.join(', ')})` : ''
              }`}
              value={priceOverride}
              onChange={(e) => setPriceOverride(e.target.value)}
              onBlur={(e) => saveOverride(e.target.value)}
              className="h-9 font-mono"
            />
            <p className="text-[11px] text-fg-subtle">
              {trip.gas_price != null
                ? `Using your override of $${effectivePrice.toFixed(2)}/gal.`
                : states.length
                  ? `Averaging ${states.length} state${states.length > 1 ? 's' : ''} the route passes through: $${autoPrice.toFixed(2)}/gal. Leave blank to keep auto.`
                  : `Using the national average ($${autoPrice.toFixed(2)}/gal) until the route is mapped.`}
            </p>
          </div>

          {!activeRouteId && (
            <p className="text-[11px] text-fg-subtle">
              Add stops to a route to see the fuel cost.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Select({
  label,
  value,
  items,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  items: MenuItem[];
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-9 px-2 rounded-lg border border-border bg-surface text-sm text-fg disabled:opacity-50 focus-visible:outline-none focus-visible:border-accent/60"
      >
        <option value="">{disabled ? '—' : 'Select…'}</option>
        {items.map((it) => (
          <option key={it.value} value={it.value}>
            {it.text}
          </option>
        ))}
      </select>
    </div>
  );
}

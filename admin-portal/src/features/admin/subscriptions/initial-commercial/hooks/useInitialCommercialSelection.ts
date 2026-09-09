import type { InitialCommercialTerms } from "../initial-commercial-request";

export function useInitialCommercialSelection(value: InitialCommercialTerms, onChange: (next: InitialCommercialTerms) => void, locked: boolean) {
  const setBaseSeats = (selectionKey: string, seats: string) => {
    if (!locked) onChange({ ...value, applications: value.applications.map(item => item.selectionKey === selectionKey ? { ...item, seats: Number(seats) } : item) });
  };
  const setAddonSeats = (parentKey: string, childKey: string, seats: string) => {
    if (!locked) onChange({ ...value, applications: value.applications.map(item => item.selectionKey === parentKey
      ? { ...item, addons: item.addons.map(child => child.selectionKey === childKey ? { ...child, seats: Number(seats) } : child) } : item) });
  };
  const removeAddon = (parentKey: string, childKey: string) => {
    if (!locked) onChange({ ...value, applications: value.applications.map(item => item.selectionKey === parentKey
      ? { ...item, addons: item.addons.filter(child => child.selectionKey !== childKey) } : item) });
  };
  const removeApplication = (selectionKey: string) => {
    if (!locked) onChange({ ...value, applications: value.applications.filter(item => item.selectionKey !== selectionKey) });
  };
  return { setBaseSeats, setAddonSeats, removeAddon, removeApplication };
}

export interface SearchOption {
  value: string;
  label: string;
}

/** A field the user can search in. With options it expands into the options whose label matches the text. */
export interface SearchField {
  id: string;
  label: string;
  hint?: string;
  chipHint?: string;
  options?: SearchOption[];
}

/** One chip in the search box: values of the same field are joined with OR, chips with AND. */
export interface SearchFacet {
  field: string;
  label: string;
  values: SearchOption[];
}

export const PRESET_FIELD = 'preset';

export function addToFacets(facets: SearchFacet[], field: string, label: string, values: SearchOption[]): SearchFacet[] {
  const existing = facets.find((facet) => facet.field === field);
  if (!existing) return [...facets, { field, label, values }];
  const added = values.filter((value) => !existing.values.some((item) => item.value === value.value));
  return facets.map((facet) => (facet === existing ? { ...facet, values: [...facet.values, ...added] } : facet));
}

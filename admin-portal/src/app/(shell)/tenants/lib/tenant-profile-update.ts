export interface TenantAddressUpdate {
  city?: string;
  state?: string;
  district?: string;
  street1?: string;
  street2?: string;
  buildingNo?: string;
  postalCode?: string;
  landmark?: string;
  formattedAddress?: string;
}

export interface TenantProfileUpdateSource {
  updatedAt: string;
  companyName?: string;
  countryName?: string;
  countryIsoCode?: string;
  industry?: string | null;
  timezone?: string | null;
  phoneCountryCode?: string | null;
  phone?: string | null;
  address?: TenantAddressUpdate | null;
  taxNumber?: string | null;
  commercialRegistrationNumber?: string | null;
}

export interface UpdateTenantProfileDto {
  expectedUpdatedAt: string;
  companyName?: string;
  countryName?: string;
  countryIsoCode?: string;
  industry?: string | null;
  timezone?: string | null;
  phoneCountryCode?: string | null;
  phone?: string | null;
  address?: TenantAddressUpdate | null;
  taxNumber?: string | null;
  commercialRegistrationNumber?: string | null;
}

export function buildUpdateTenantProfileDto(
  source: TenantProfileUpdateSource,
): UpdateTenantProfileDto {
  const dto: UpdateTenantProfileDto = {
    expectedUpdatedAt: source.updatedAt,
  };

  copyDefined(dto, source, "companyName");
  copyDefined(dto, source, "countryName");
  copyDefined(dto, source, "countryIsoCode");
  copyDefined(dto, source, "industry");
  copyDefined(dto, source, "timezone");
  copyDefined(dto, source, "phoneCountryCode");
  copyDefined(dto, source, "phone");
  copyDefined(dto, source, "address");
  copyDefined(dto, source, "taxNumber");
  copyDefined(dto, source, "commercialRegistrationNumber");

  return dto;
}

function copyDefined<
  Key extends Exclude<keyof UpdateTenantProfileDto, "expectedUpdatedAt">,
>(
  target: UpdateTenantProfileDto,
  source: TenantProfileUpdateSource,
  key: Key,
) {
  const value = source[key];
  if (value !== undefined) {
    Object.assign(target, { [key]: value });
  }
}

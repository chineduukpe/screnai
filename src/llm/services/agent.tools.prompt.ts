// export const PROPERTY_OVERVIEW = (propertyAddress: string) =>
//   `Take the following address: ${propertyAddress}

//   Generate an informative, interesting property overview for a real estate investor in the underwriting process.
//   The property overview should be two paragraphs and should try to include the following information: location, block & lot, lot size (SQFT, length x width), building size,
//   number of stories, number of units (unit mix), garage units, building type, architecture style, etc. Avoid using ** in your response and give a well expended response`;

export const PROPERTY_OVERVIEW = (
  propertyAddress: string,
  rentRollData?: string,
  t12Data?: string,
  propertySummaryTable?: string,
) =>
  `Take the following address: ${propertyAddress}

  Generate an informative, interesting property overview for a real estate investor in the underwriting process.
  The property overview should be two paragraphs and should try to include the following information: location, block & lot, lot size (SQFT, length x width), building size,
  number of stories, number of units (unit mix), garage units, building type, architecture style, etc.

  ${
    propertySummaryTable &&
    `Also for the property summary table ${propertySummaryTable}`
  }

  ${
    rentRollData
      ? `Additionally, consider the following rent roll data in your overview:\n${rentRollData}\n`
      : ''
  }
  ${
    t12Data
      ? `Also, incorporate insights from this T12 (trailing 12-month operating statement) data:\n${t12Data}\n`
      : ''
  }

  Avoid using ** in your response and give a well expanded response`;

export const NEIGHNORHOOD_OVERVIEW = (propertyAddress: string) =>
  `Take the following address: ${propertyAddress}
  
  Generate an informative, interesting neighborhood overview for a real estate investor in the underwriting process.
  Include information about the local community, amenities, and other factors that may impact the market. Avoid using ** in your response and give a well expended response`;

export const LOCAL_ATTRACTIONS = (propertyAddress: string) =>
  `Take the following address: ${propertyAddress}
  
  Generate an informative, interesting local attractions for a real estate investor in the underwriting process.
  Include information about popular tourist attractions, cultural events, and other factors that may impact the market. Avoid using ** in your response and give a well expended response`;

export const TRANSPORTATION = (propertyAddress: string) =>
  `Take the following address: ${propertyAddress}
  
  Generate an informative, interesting overview of transportation for a real estate investor in the underwriting process. Avoid using ** in your response and give a well expended response`;

export const JOBMARKET_OVERVIEW = (propertyAddress: string) =>
  `Take the following address: ${propertyAddress}
  
  Generate an informative, interesting job market overview for a real estate investor in the underwriting process.
  Include information about top employers in the area, job growth, and job opportunities in the area. Avoid using ** in your response and give a well expended response`;

export const SUBMARKET_OVERVIEW = (propertyAddress: string) =>
  `Take the following address: ${propertyAddress}
  
  Generate an informative, interesting overview of the larger city or region for a real estate investor in the underwriting process.
  Include information about the local economy, demographics, and other factors that may impact the market. Avoid using ** in your response and give a well expended`;

export const DEMOGRAPHIC_OVERVIEW = (propertyAddress: string) =>
  `Take the following address: ${propertyAddress}
  
  Generate an informative, interesting overview of the demographics for a real estate investor in the underwriting process.
  Include information about age, income, education, and other factors that may impact the market. Avoid using ** in your response and give a well expended response`;

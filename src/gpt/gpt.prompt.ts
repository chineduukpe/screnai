export const RENTROLL_COLUMN_NAME_SYSTEM_PROMPT = `
Help the user guess the correct column name. 

The user will provide a table with the first and second values in each row. For each row, you will return the entire row with the third value added.

You can only guess the following values:

n_tenant_name
n_bed
n_bath
n_unit_id
n_unit_type
n_unit_sqft
n_market_rent
n_rent
n_vacancy
n_misc
n_total
n_balance
n_security
n_unit_status
n_charge_code
n_charge_code_amount
n_default
n_move_in
n_move_out
n_lease_end
n_lease_start
n_unit_size

You can use "Skip" as the value if you are not confident. Do not make things up.

Treat * as any value

Here are some examples:

Tenant Name| Leslie Williams | n_tenant_name
Unit | 117 | n_unit_id
Unit Type | 1/1 - 715 | n_unit_type
Unit Type | Studio | n_unit_type
Bed | 1 | n_bed
Bath | 2 | n_bath
Type | 2 X 1 | n_unit_type
Sq Ft | 500 | n_unit_sqft
Market Rent | 2,025.00 | n_market_rent
Rent | 1,723.00 | n_rent
Budgeted Rent | 1,200.00 | n_market_rent
Scheduled Charges | 1,200.00 | n_rent
Amount | 1,491.00 | n_rent
Amount | 500 | n_rent
Unit Type | 2 | n_unit_type
Total Charges | 1,945.00 | n_total
Balance | -10 | n_balance
Security Deposit | 3,446.00 | n_security
Amount | 500 | n_rent
Amount | | n_rent
Rent | | n_rent
Increase Amount | 0 | n_default
Last Rent Increase | 200 | n_default
Move In | 8/5/22 | n_move_in
Move Out | 12/31/22 | n_move_out
Lease End | 9/30/23 | n_lease_end
Lease Start | 9/30/23 | n_lease_start
Lease Date | 5/31/1998 | n_lease_start
Floorplan | T3/1.5 M-A | n_unit_type
SQFT | 1100 | n_unit_sqft
Unit/Lease Status | Occupied | n_unit_status
Unit/Lease Status | Pending renewal | n_unit_status
Unit/Lease Status | Vacant | n_unit_status
Unit/Lease Status | Vacant-Leased | n_unit_status
Name | LOOPER, MISTY | n_tenant_name
Lease Rent | 1,450.00 | n_rent
Other Charges/ Credits | 0 | n_misc
Security Deposit | 2000 | n_security
Dep On Hand | 500 | n_security
balance | 1,001.00 | n_balance
Market + Addl. | 1,045.00 | n_market_rent
Total Billing | 1,130.00 | n_total
Unit Type | 2/1.00 RWD | n_unit_type
Charge Code | Rent | n_charge_code
Charge Code | Pet | n_charge_code
Charge Code | Cable | n_charge_code
Charge Code | Utility | n_charge_code
Charge Code | Waiver Program Fee | n_charge_code
Charge Code | Storage Fees | n_charge_code
Charge Code | Month-to-Month Premiums | n_charge_code
Charge Code | Waiver Program Fee | n_charge_code
Scheduled Charges | 757 | n_charge_code_amount
Balance | (9.00) | n_balance
Type | 2br2ba | n_unit_type
unit | 1014-101 | n_unit_id
RC | 745.00 | n_rent
Move In | 08/01/2019 | n_move_in
Move-In | 08/16/2021  | n_move_in
Lease Expiration | 08/31/2023 | n_lease_end
Move Out | | n_move_out
Move-Out | 05/30/2023 | n_move_out
Move-Out |  | n_move_out
Expected Move-Out | 05/30/2023 | n_move_out
Lease End | 05/30/2023 | n_lease_end
Size | 5x10 | n_unit_size
Status | vacant | n_unit_status
Status | occupied | n_unit_status
`;

export const RENT_ROLL_COL_NAME_AND_INDEX_SYSTEM_PROMPT = `
When the user sends a table, reply with the table column names and their index.

Here is an example:

Unit|Unit Type|Unit|Resident|Name|Market|Actual|Resident|Status|Other|Move In|Lease\n||Sq Ft|||Rent|Rent|Deposit|Deposit||Expiration|Move Out|\n|Current/Notice/Vacant|Residents||||||||\n001|N12B222|956.00|t0611698|MELISSA RUIZ CAR|870.00|850.00|100.00|500.00|06/14/2019|04/13/2022\n002|N12B322R|956.00|t0688040|KARLA OROZCO|975.00|850.00|450.00|0.00|06/12/2020|06/11/2021\n003|N12B222R|956.00|VACANT|VACANT|945.00|0.00|0.00|0.00||\n'

1     | Unit
2     | Unit Type
3     | Unit Sq Ft
4     | Resident
5     | Name
6     | Market Rent
7     | Actual Rent
8     | Resident Deposit
9     | Other Deposit
10    | Move In
11    | Lease Expiration
12    | Move Out 
13    | Bed 
14    | Bath 
15    | Status 
`;

export const UNIT_TYPE_SYSTEM_PROMPT = `
Assume the user provides a list of rent roll units separated by the |  symbol

return a list of the different unit types

Here is an example

"|1A||1B||1C|||2A||2B||2C|3A|||||3B"

should return 
[1,2,3]
`;

export const OPERATING_STATEMANT_ENTRIES_CATEGORY_SYSTEM_PROMPT = `Assume you are given a list of operating statement entries separated by the | symbol

Return an array of mapping of the fields based income or operating expense based on commercial real estate

Here are the categories

1 income
2 operating expenses

Here are some income subcategories

1 Current Market Rents
2 Renovation Premium
3 Scheduled Mkt. Rents
4 Loss to Lease
5 Reno Loss to Lease
6 Vacancy Loss
7 Renovation Vacancy
8 Non-Revenue Units
9 Concessions
10 Credit Loss
11 Net Rental Revenue
12 Other Income
13 Utility Income
14 Water/Sewer Income
15 Cable Income
16 Laundry Income
17 Pest Income
18 Insurance Income
19 Garbage Income
20 Parking Income
21 Pet Income
22 Total Other Income
23 Total Income

Here are some expense subcategories

1 Administrative
2 Utilities
3 Other Utilities
4 Water & Sewer
5 Electric & Gas
6 Repair & Maintenance
7 Turnkey
8 Pest Control & Garbage
9 Security
10 Payroll
11 Contract Services
12 Grounds
13 Other Taxes
14 Cable Expense
15 Corporate Unit Expense
16 Management Fee
17 Other Operating Expenses
18 Insurance
19 Taxes
20 Replacement Reserves
21 Total Expenses


Here is an example

"Scheduled Rent|Month to Month Fees|Vacancy Loss|Gain to Lease|Loss to Lease|Temp Labor Help|Professional Services|Exterminating" 


return 
[{"lineItem": "Scheduled Rent","category": "income", subcategory: "total income"},{"lineItem": "Month to Month Fees","category": "income", subcategory: "total income"},{"lineItem": "Vacancy Loss","category": "income", "subcategory":"total income"},{"lineItem": "Gain to Lease","category": "income", "subcategory": "total income"},{"lineItem": "Temp Labor Help","subcategory": "payroll", "category":"operating expenses"}, {"lineItem":"Professional Services","category": "operating expenses","subcategory":"Corporate Unit Expense"}, {"lineItem":"Exterminating","category": "operating expenses","subcategory":"other operating expenses"}]

Even if you have only one object, return as an array

Usually, income items come under the INCOME header and all items after the expenses header fall under expenses

Do not add breaking next line spacing

if category is "operating expense" return "operating expenses"

If item is an aggregation or sum or subtraction of other line items, skip and do not categorize. Remove from response data 

Here are some examples of net other line items to skip include Net rental income, Net Delinquency, Net other income

`;

export const RENTROLL_COLUMN_INDUSTRIAL_SYSTEM_PROMPT = `
Help the user guess the correct column name.

The user will provide a table with the first and second values in each row. For each row, you will return the entire row with the third value added.

You can only guess the following values:

n_tenant_name
n_unit
n_size
n_company
n_lease_end_date
n_billing_day
n_tax
n_security_deposit
n_standard_rate
n_rental_rate
n_variance
n_market_rent
n_scheduled_date
n_change_balance


You can use "Skip" as the value if you are not confident. Do not make things up.

Treat * as any value


Here are some examples:

Name | Choi,Yung |n_tenant_name
Unit | C215 | n_unit
Size | 5 x 10 | n_size
Company | Commercial Marine Service | n_company
Lease End | 9/30/23 | n_lease_end_date
Billing Day | 1 | n_billing_day
Tax Exempt | |n_tax
Security Deposit | | n_security_deposit
Standard Rate |50.00 | n_standard_rate
Variance | -15.00 | n-variance
Scheduled rate | | n_market_rent
Scheduled Date | | n_scheduled_date
Chang Balance |50.00 | n-change_balance


Name | Choi,Yung |n_tenant_name
Unit | C215 | n_unit
Size | 5 x 10 | n_size
Company | Source Inc | n_company
Lease End | 9/30/23 | n_lease_end_date
Billing Day | 3 | n_billing_day
Tax Exempt | |n_tax
Security Deposit | | n_security_deposit
Standard Rate |125.00 | n_standard_rate
Variance | -5.00 | n-variance
Scheduled rate | | n_market_rent
Scheduled Date | | n_scheduled_date
Chang Balance |80.00 | n-change_balance


Name | harper,Roy |n_tenant_name
Unit | C345 | n_unit
Size | 5 x 5 | n_size
Company | Nophin | n_company
Lease End | 5/30/21 | n_lease_end_date
Billing Day | 4 | n_billing_day
Tax Exempt | | n_tax
Security Deposit | 100.00| n_security_deposit
Standard Rate |150.00 | n_standard_rate
Variance | -25.00 | n-variance
Scheduled rate | | n_market_rent
Scheduled Date | | n_scheduled_date
Chang Balance |60.00 | n_change_balance
`;

export const PROPERTY_OVERVIEW_PROMPT = (address_input: string) => `
Take the following address: ${address_input}

Generate an informative, interesting property overview and market overview, for a real estate investor in the underwriting process.
The property overview should be two paragraphs and should try to include the following information: location, block & lot, lot size (SQFT, length x width), building size,
number of stories, number of units (unit mix), garage units, building type, architecture style, etc. The market overview should be four paragraphs long and should try to include the following information: location analysis, economic Indicators, supply and demand dynamics, competitive landscape, regulatory and zoning issues, macro trends impacting real estate,
investment performance indicators, taxes (rate, amount, assessed value, tax map, exemptions) etc. Include as much quantitative data as possible. Include some history of the property and market. Refrain from giving investment advice.
Here is the structure:
<h1>Property Overview<h1>
Area Metrics
Structural Metrics
<h1>Market Overview<h1>
Location and Economy
Supply and Demand
Regulatory and Macro Trends
Investment Potential
Return the response like its a data coming from a rich text editor. Use apppropiate html header tags for headers and p tag for paragraphs. Add some inline styling to the tags. Make all the headings bold. Add a line break after each closing paragraph tags. Increase the size of the headings. Set h1 to be 24px and the other headings to 20px.

Refrain from giving investment advice.`;

export const ANALYSIS_DATA_PROMPT = (
  underwriting: any,
  rentroll_data: any,
  t12_data: any,
) => {
  const serializedRentRoll = JSON.stringify(rentroll_data, null, 2); // Use null, 2 for pretty-printing
  const serializedT12 = JSON.stringify(t12_data, null, 2);
  const underwritingData = JSON.stringify(underwriting, null, 2);

  return `
Analyze the following JSON data of a rent roll document:\n${serializedRentRoll}\n
Analyze the following JSON data of a T12 document:\n${serializedT12}\n
Analyze the following JSON data of a Underwriting document:\n${underwritingData}\n

Create a summary of each underwriting, rent roll, and T12 data. Each data type should have 2 paragraphs detailed summary. 
Here is the structure:

<h1>Rent Roll Summary</h1>
<h1>T12 Summary</h1>
<h1>Underwriting Summary</h1>

Return the response like it's data coming from a rich text editor. Use appropriate HTML header tags for headers and p tag for paragraphs. 
Add some inline styling to the tags. Make all the headings bold. Add a line break after each closing paragraph tag. Increase the size of the headings. 
Set h1 to be 24px and the other headings to 20px.
`;
};

const SIMPLE_INVESTMENT_MEMO_GENERATION_USER_TEMPLATE_STRINGS = [
  `I'm a commercial real estate investor buying the property at `,

  `
Generate an investment memo that include the following information:
- overview of the neighborhood
- overview of the submarket
- overview of the market 
- demographics 
- job growth
- local attractions
- why this is an attractive deal
- potential risks for the specific area

Keep it concise and do not make anything up.

Also return the response like its a data coming from a rich text editor. Use apppropiate html header tags for headers and p tag for paragraphs. Add some inline styling to the tags. Make all the headings bold. Add a line break after each closing paragraph tags. Increase the size of the headings. Set h1 to be 24px and the other heading to 20px.`,
];

export const SIMPLE_INVESTMENT_MEMO_PROMPT_GENERATION = (
  propertyAddress: string,
) =>
  `${SIMPLE_INVESTMENT_MEMO_GENERATION_USER_TEMPLATE_STRINGS[0]}${propertyAddress}.${SIMPLE_INVESTMENT_MEMO_GENERATION_USER_TEMPLATE_STRINGS[1]}`;

export const PROPERTY_OVERVIEW = (propertyAddress: string) =>
  `Take the following address: ${propertyAddress}

Generate an informative, interesting property overview for a real estate investor in the underwriting process.
The property overview should be two paragraphs and should try to include the following information: location, block & lot, lot size (SQFT, length x width), building size,
number of stories, number of units (unit mix), garage units, building type, architecture style, etc. Avoid using ** in your response and give a well expended response`;

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

export const PROCESS_INPUT = (textInput: any, extractedText: any) =>
  `Take the following user input: ${textInput}. Take the follwoing information from the editor content: ${extractedText}
You are an expert assistant about the commercial real estate industry. Produce an answer for the user based on the information provided in the text input. Refrain from giving investment advice and also try to give a direct answer and DO NOT start your response with 'Based on the information provided'.`;

export const IMPROVE_WRITING = (
  textInput: any,
) => `Take the following text input: ${textInput}. 
Improve the writing by adding more details and making it more concise.`;

export const SHORTEN_WRITING = (
  textInput: any,
) => `Take the following text input: ${textInput}. 
Improve the writing by shortening it and making it more concise.`;

export const LENGTHEN_WRITING = (
  textInput: any,
) => `Take the following text input: ${textInput}. 
Improve the writing by adding more details.`;

export const SIMPLIFY_WRITING = (
  textInput: any,
) => `Take the following text input: ${textInput}. 
Improve the writing by making it more concise.`;

export const RENT_COMP_SUMMARY = (address: any) =>
  `Take the following addresses: ${address},

Generate a concise qualitative summary of the address. The summary should be no more than 3-4 sentences.`;

export const SPLIT_COLUMN_PROMPT = `
  The user will provide two sets of CSV table1 and table2.
  Given the CSV in table1 find and separate the merged column in table2

  do not show how it is done. Only return the result

  Assume the larger table to be the table1

  Here is an example

  ###table1
  unit,floorplan,rent,charges
  h12,2x2,1200,0.00
  h13,2x3,800,1.0
  h18,2x2,1320,1.0

  ###table2
  h22,2x2978,2.19
  h24,2x42100,3.1
  h30,2x1449,1.3

  return 
  h22,2x2,978,2.19
  h24,2x4,2100,3.1
  h30,2x1,449,1.3
  
  `;

export const GENERATE_DEAL_NAME_FROM_EMAIL_SUBJECT_PROMPT = `
    A user will provide you with an text, generate a meaningful name for a real estate deal from the text.

    First try to find and use the address in the text, if you cannot find an, find a project name. In that order of priority.

    If you cannot find an address or a project name, create a meaningful name from the text

    Here is an example

    Given 
    
    Fwd: Crexi Response North Oak Project

    return North Oak Crexi Deal

    Here is another example 

    Property for Spiveys Corner, NC, USA Proposal
    return Spivey Corner, NC, USA
  `;

export const GENERATE_DOCUMENT_TYPE_FROM_EMAIL_ATTACHMENT_PROMPT = `
  The user user will provide you with the first two pages of a document.

  We are looking for rent roll, operating statement, costar report and offering-memorandum for commercial real estate properties.

  If you cannot determine if the document fall under any of the above document types, just return others.

  Example response

  rent roll
  operating statement
  offering-memorandum
  costar report
  `;

export const GENERATE_EMAIL_PROPERTY_ADDRESS_PROMPT = `
  The user will provide you with a text.

  Find the main address for the property in the text context

  Return only one address with no additional text

  If you find more than one address, only return the most relevant one based on the text context

  `;

//The user will provide you with two sets of data, the first is the sample data #table1 with correct number of column

//Based on the #table1, determine the merged columns in the second table #table2 data and split.

//only return the CSV representation of the fixed #table2. Nothing more

export const NOPHIN_MODEL_HEADER_PROMPT = `Based on the image, the unit number is given by column _____(A), market rent by _____(B), actual rent by _____(C), unit status (occupied) by _____(D), the number of baths is given by _____(E), number of beds by _____(F), unit square feet by _____(G), lease start by _____(H), lease end by _____(I), the unit type is given by column _____(J) and floor plan by _____(K). Think this through and give me the names of the columns in blanks A, B, C, D, E, F, G, H, I, and J as a compressed json.`;

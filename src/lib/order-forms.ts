// Every athlete order form the Hub hosts. Add one entry per campaign.
// - slug:       the athlete link is /order/<slug>; the page files live in public/order-forms/<slug>/
// - sheetEnv:   name of the Vercel environment variable holding that form's Google Apps Script web-app URL
// - sheetLink:  the Google Sheet the team opens to see orders
// - brandName:  used to look up the brand's logo in the `brands` table (never typed as text)
export type OrderForm = {
  slug: string;
  title: string;
  brandName: string;
  sheetEnv: string;
  sheetLink: string;
  status: "live" | "closed";
};

export const ORDER_FORMS: OrderForm[] = [
  {
    slug: "hollister-feel-good-fleece",
    title: "Feel Good Fleece",
    brandName: "Hollister",
    sheetEnv: "ORDER_FORM_SHEET_URL_HOLLISTER_FGF",
    sheetLink: "https://docs.google.com/spreadsheets/d/1oI_rS3GyM0ditLm-vRUuxJgIqT2vb1PmglqAKh0Iu_M/edit",
    status: "live",
  },
];

export const orderFormPath = (slug: string) => `/order/${slug}`;

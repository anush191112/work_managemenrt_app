export type CampaignType = "whatsapp" | "email";
export type CampaignAccount = "whatsapp_9928781655" | "whatsapp_9928501655" | "email_stonekingexports" | "email_stonekingexportindia";

export function isCampaignAccount(value: unknown): value is CampaignAccount {
  return ["whatsapp_9928781655", "whatsapp_9928501655", "email_stonekingexports", "email_stonekingexportindia"].includes(String(value));
}

export function accountMatchesType(account: CampaignAccount, type: CampaignType): boolean {
  return account.startsWith(type);
}

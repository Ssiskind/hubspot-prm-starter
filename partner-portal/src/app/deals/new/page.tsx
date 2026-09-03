import { auth, PartnerSession } from "@/lib/auth";
import { getPriceBookItemsForTier } from "@/lib/hubspot";
import DealRegistrationForm from "./DealRegistrationForm";

export default async function NewDealRegistrationPage() {
  const session = (await auth()) as unknown as PartnerSession;
  const priceBookItems = await getPriceBookItemsForTier(session.partnerTier);
  return (
    <DealRegistrationForm
      partnerTier={session.partnerTier}
      discountFloorPct={session.discountFloorPct}
      discountCeilingPct={session.discountCeilingPct}
      payoutRatePct={session.payoutRatePct}
      priceBookItems={priceBookItems}
    />
  );
}

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const PLAN_MAP: Record<string, string> = {
  [process.env.STRIPE_PRICE_SCOUT || "price_scout"]: "scout",
  [process.env.STRIPE_PRICE_PRO || "price_pro"]: "pro",
  [process.env.STRIPE_PRICE_ENTERPRISE || "price_enterprise"]: "enterprise",
};

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = createServiceClient();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;
        const userId = session.metadata?.supabase_user_id;

        if (!customerId || !subscriptionId) {
          console.error("Missing customer or subscription ID in checkout session");
          break;
        }

        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const priceId = subscription.items.data[0]?.price.id;
        const plan = (priceId && PLAN_MAP[priceId]) || "scout";

        // Try to find user by stripe_customer_id first, then by metadata user_id
        const updateData = {
          plan,
          stripe_customer_id: customerId,
          updated_at: new Date().toISOString(),
        };

        const { error } = userId
          ? await supabase.from("profiles").update(updateData).eq("id", userId)
          : await supabase.from("profiles").update(updateData).eq("stripe_customer_id", customerId);

        if (error) console.error("Profile update failed after checkout:", error.message);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        if (!customerId) break;

        const { error } = await supabase
          .from("profiles")
          .update({ plan: "free", updated_at: new Date().toISOString() })
          .eq("stripe_customer_id", customerId);

        if (error) console.error("Profile downgrade failed:", error.message);
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        const priceId = subscription.items.data[0]?.price.id;
        const plan = (priceId && PLAN_MAP[priceId]) || "scout";

        if (!customerId) break;

        if (subscription.status === "active") {
          const { error } = await supabase
            .from("profiles")
            .update({ plan, updated_at: new Date().toISOString() })
            .eq("stripe_customer_id", customerId);

          if (error) console.error("Profile plan update failed:", error.message);
        } else if (subscription.status === "past_due" || subscription.status === "unpaid") {
          console.warn(`Subscription ${subscription.id} is ${subscription.status}`);
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        console.warn(`Payment failed for customer ${customerId}, invoice ${invoice.id}`);
        break;
      }
    }
  } catch (err) {
    console.error("Webhook processing error:", err);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

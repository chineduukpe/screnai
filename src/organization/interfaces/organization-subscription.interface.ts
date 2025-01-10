export interface OrganizationSubscriptionI {
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  stripeProductId?: string;
  status?: string;
  cancellation?: SubscriptionCancellationI;
}

export interface SubscriptionCancellationI {
  cancelAt: Date;
  details: {
    comment?: string;
    feedback?: string;
    reason?: string;
  };
  cancelledAt: Date;
  cancelAtPeriodEnd: boolean;
}

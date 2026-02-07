import React from 'react';
import { Check } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';

const pricingTiers = [
  {
    name: 'Free',
    price: 0,
    period: 'forever',
    description: 'Perfect for trying out the app',
    features: [
      'Up to 10 recipes',
      'Basic meal planning',
      'Shopping lists',
      'Weekly meal calendar',
    ],
    limitations: [
      'No AI recipe parsing',
      'No nutrition tracking',
      'No analytics',
    ],
    cta: 'Get Started',
    popular: false,
  },
  {
    name: 'Family',
    price: 9.99,
    period: 'month',
    description: 'Great for families who cook regularly',
    features: [
      'Unlimited recipes',
      '50 AI recipe parses/month',
      'Nutrition tracking',
      'Analytics dashboard',
      'Meal prep mode',
      'Budget tracking',
      'Recipe collections',
      'Leftover intelligence',
    ],
    cta: 'Subscribe Now',
    popular: true,
  },
  {
    name: 'Premium',
    price: 19.99,
    period: 'month',
    description: 'For serious home cooks and meal planners',
    features: [
      'Everything in Family',
      'Unlimited AI recipe parses',
      'Advanced nutrition analytics',
      'Custom meal templates',
      'Family sharing (up to 5 users)',
      'Priority support',
      'Recipe imports from any site',
      'Meal planning AI assistant',
    ],
    cta: 'Subscribe Now',
    popular: false,
  },
  {
    name: 'Lifetime',
    price: 299,
    period: 'once',
    description: 'Pay once, use forever',
    features: [
      'All Premium features',
      'Lifetime access',
      'All future updates included',
      'Priority support forever',
      'No monthly fees ever',
    ],
    cta: 'Buy Lifetime',
    popular: false,
  },
];

const PricingPage: React.FC = () => {
  const handleSubscribe = (tierName: string) => {
    // Stripe integration is planned but not yet implemented.
    // When ready, this will redirect to Stripe Checkout with the selected tier.
    // See: https://stripe.com/docs/payments/checkout
    alert(`Stripe integration coming soon! You selected: ${tierName}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-primary/5 py-12 px-4 sm:px-6 lg:py-16">
      <div className="max-w-7xl mx-auto space-y-16">
        {/* Header */}
        <div className="text-center space-y-4 animate-fade-in">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-foreground tracking-tight">
            Choose Your Plan
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Start free, upgrade when you need more features. Cancel anytime.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
          {pricingTiers.map((tier, index) => (
            <Card
              key={tier.name}
              className={`relative flex flex-col transition-all duration-200 hover:shadow-xl animate-scale-in ${
                tier.popular
                  ? 'border-primary/50 shadow-lg ring-2 ring-primary/10 lg:scale-105'
                  : 'border-border/50 hover:border-primary/30'
              }`}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {tier.popular && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 shadow-md">
                  Most Popular
                </Badge>
              )}

              <CardHeader className="space-y-3 pb-6">
                <CardTitle className="text-2xl font-bold">{tier.name}</CardTitle>
                <CardDescription className="text-base">
                  {tier.description}
                </CardDescription>
                <div className="pt-2">
                  <div className="flex items-baseline gap-1">
                    <span className="text-5xl font-bold text-foreground tracking-tight">
                      ${tier.price}
                    </span>
                    <span className="text-lg text-muted-foreground font-medium">
                      /{tier.period}
                    </span>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="flex-1 space-y-4">
                <ul className="space-y-3">
                  {tier.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-start gap-3">
                      <Check
                        className="h-5 w-5 text-primary flex-shrink-0 mt-0.5"
                        aria-hidden="true"
                      />
                      <span className="text-sm text-foreground leading-relaxed">
                        {feature}
                      </span>
                    </li>
                  ))}
                  {tier.limitations &&
                    tier.limitations.map((limitation, limitIndex) => (
                      <li
                        key={`limit-${limitIndex}`}
                        className="flex items-start gap-3 text-muted-foreground/70"
                      >
                        <span className="text-sm ml-8 leading-relaxed">
                          {limitation}
                        </span>
                      </li>
                    ))}
                </ul>
              </CardContent>

              <CardFooter className="pt-6">
                <Button
                  className="w-full transition-all duration-150 hover:scale-[1.02] active:scale-[0.98]"
                  variant={tier.popular ? 'default' : 'outline'}
                  size="lg"
                  onClick={() => handleSubscribe(tier.name)}
                  aria-label={`Subscribe to ${tier.name} plan for $${tier.price} per ${tier.period}`}
                >
                  {tier.cta}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        {/* FAQ Section */}
        <div className="max-w-3xl mx-auto space-y-8 animate-fade-in">
          <h2 className="text-3xl sm:text-4xl font-bold text-center text-foreground">
            Frequently Asked Questions
          </h2>
          <div className="grid gap-6 sm:gap-8">
            <Card className="border-border/50 hover:border-primary/30 transition-colors duration-150">
              <CardContent className="pt-6 space-y-2">
                <h3 className="text-lg font-semibold text-foreground">
                  Can I cancel anytime?
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  Yes! Cancel your subscription anytime. You'll keep access until the end of your billing period.
                </p>
              </CardContent>
            </Card>

            <Card className="border-border/50 hover:border-primary/30 transition-colors duration-150">
              <CardContent className="pt-6 space-y-2">
                <h3 className="text-lg font-semibold text-foreground">
                  What payment methods do you accept?
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  We accept all major credit cards, debit cards, and digital wallets through Stripe.
                </p>
              </CardContent>
            </Card>

            <Card className="border-border/50 hover:border-primary/30 transition-colors duration-150">
              <CardContent className="pt-6 space-y-2">
                <h3 className="text-lg font-semibold text-foreground">
                  Is there a free trial?
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  The Free plan is available forever! You can upgrade to paid plans whenever you need more features.
                </p>
              </CardContent>
            </Card>

            <Card className="border-border/50 hover:border-primary/30 transition-colors duration-150">
              <CardContent className="pt-6 space-y-2">
                <h3 className="text-lg font-semibold text-foreground">
                  What's included in AI recipe parsing?
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  Our AI can extract recipes from any website, photo, or text. Just paste a URL or take a photo, and we'll automatically create a structured recipe.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center space-y-6 py-12 animate-fade-in">
          <div className="space-y-4">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight">
              Ready to transform your meal planning?
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Join thousands of families saving time and money with smarter meal planning.
            </p>
          </div>
          <Button
            size="lg"
            onClick={() => handleSubscribe('Family')}
            className="px-8 py-6 text-lg transition-all duration-150 hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl"
          >
            Start with Family Plan
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PricingPage;

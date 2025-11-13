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
    // TODO: Integrate with Stripe checkout
    console.log(`Subscribing to ${tierName}`);
    alert(`Stripe integration coming soon! You selected: ${tierName}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
            Choose Your Plan
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
            Start free, upgrade when you need more features. Cancel anytime.
          </p>
        </div>

        {/* Pricing Cards - Mobile Responsive Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          {pricingTiers.map((tier) => (
            <Card
              key={tier.name}
              className={`pricing-tier relative flex flex-col ${
                tier.popular ? 'border-primary border-2 shadow-lg scale-105' : ''
              }`}
            >
              {tier.popular && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                  Most Popular
                </Badge>
              )}

              <CardHeader>
                <CardTitle className="text-2xl">{tier.name}</CardTitle>
                <CardDescription>{tier.description}</CardDescription>
                <div className="mt-4">
                  <span className="text-4xl sm:text-5xl font-bold">
                    ${tier.price}
                  </span>
                  <span className="text-muted-foreground ml-2">
                    /{tier.period}
                  </span>
                </div>
              </CardHeader>

              <CardContent className="flex-1">
                <ul className="space-y-3">
                  {tier.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                  {tier.limitations && tier.limitations.map((limitation, index) => (
                    <li key={`limit-${index}`} className="flex items-start gap-2 text-muted-foreground">
                      <span className="text-sm ml-7">{limitation}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>

              <CardFooter>
                <Button
                  className="w-full cta-button"
                  variant={tier.popular ? 'default' : 'outline'}
                  size="lg"
                  onClick={() => handleSubscribe(tier.name)}
                >
                  {tier.cta}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        {/* FAQ Section */}
        <div className="mt-16 max-w-3xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-8">
            Frequently Asked Questions
          </h2>
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-2">Can I cancel anytime?</h3>
              <p className="text-muted-foreground">
                Yes! Cancel your subscription anytime. You'll keep access until the end of your billing period.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">What payment methods do you accept?</h3>
              <p className="text-muted-foreground">
                We accept all major credit cards, debit cards, and digital wallets through Stripe.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">Is there a free trial?</h3>
              <p className="text-muted-foreground">
                The Free plan is available forever! You can upgrade to paid plans whenever you need more features.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">What's included in AI recipe parsing?</h3>
              <p className="text-muted-foreground">
                Our AI can extract recipes from any website, photo, or text. Just paste a URL or take a photo, and we'll automatically create a structured recipe.
              </p>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="mt-16 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4">
            Ready to transform your meal planning?
          </h2>
          <p className="text-lg text-muted-foreground mb-6">
            Join thousands of families saving time and money with smarter meal planning.
          </p>
          <Button size="lg" onClick={() => handleSubscribe('Family')}>
            Start with Family Plan
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PricingPage;
